// Uses real Leaflet, local cover fixtures and mocked map tiles; no real API writes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), 'chis-photo-map-'));
const server = await createServer({ server: { host: '127.0.0.1', port: 4177, strictPort: true } });
await server.listen();
const browser = spawn(process.env.CHIS_TEST_CHROME || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket, output = '', browserError, sequence = 0;
const pending = new Map();
browser.stderr.on('data', chunk => { output += chunk.toString(); });
browser.on('error', error => { browserError = error; });
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const until = async expression => {
  for (let attempt = 0; attempt < 150; attempt++) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error('Timed out: ' + expression);
};
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (browserError) throw browserError;
    port = output.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1];
    if (port) break;
    await delay(100);
  }
  assert.ok(port);
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (request) { pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
    if (message.method === 'Fetch.requestPaused') void call('Fetch.fulfillRequest', {
      requestId: message.params.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }],
      body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#faf2ee"/></svg>').toString('base64'),
    });
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: '*://*.tile.openstreetmap.org/*' }, { urlPattern: '*://*.basemaps.cartocdn.com/*' }] });
  await call('Page.navigate', { url: 'http://127.0.0.1:4177/tests/fixtures/photo-map.html' });
  await until("document.querySelectorAll('.heritage-marker-photo').length === 3");
  await until("[...document.querySelectorAll('.heritage-marker-photo')].every(image => image.complete && image.naturalWidth > 0)");
  assert.equal(await evaluate("document.querySelector('[title=\"Fixture site 2\"] .heritage-marker-photo').getAttribute('src')"), '/images/heritage-placeholder.svg');
  assert.equal(await evaluate("document.querySelector('[title=\"Fixture site 1\"] .heritage-marker-photo').getAttribute('src')"), '/images/logo-transparent.png');
  assert.equal(await evaluate("document.querySelectorAll('.heritage-marker svg').length"), 0);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.heritage-marker')).fontFamily === getComputedStyle(document.body).fontFamily"), true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.heritage-marker[data-selected=true] .heritage-marker-symbol')).width"), '56px');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.heritage-marker[data-selected=false] .heritage-marker-symbol')).width"), '36px');
  await evaluate("document.querySelector('[title=\"Fixture site 3\"]').click(); true");
  await until("document.querySelector('[title=\"Fixture site 3\"]').getAttribute('aria-pressed') === 'true'");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await evaluate("document.querySelector('[title=\"Fixture site 3\"]').focus(); true");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[title=\"Fixture site 3\"] .heritage-marker-symbol')).outlineWidth"), '2px');
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await delay(150);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `overflow at ${width}px`);
    assert.equal(await evaluate("document.querySelectorAll('.heritage-marker-photo').length"), 3);
    console.log(`PASS photo markers ${width}px`);
  }
  for (let count = 0; count < 8; count++) await evaluate("document.querySelector('#map-zoom-in-btn').click(); true");
  await until("document.querySelector('.heritage-map-close-zoom') !== null");
  await until("getComputedStyle(document.querySelector('.heritage-marker[data-selected=false] .heritage-marker-symbol')).width === '44px'");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.heritage-marker[data-selected=false] .heritage-marker-symbol')).width"), '44px');
  assert.deepEqual(await evaluate('window.__errors'), []);
  assert.deepEqual(await evaluate("window.__requests.filter(url => url.startsWith('/api/'))"), ['/api/heritage-sites']);
  console.log('PASS selection, image fallback, keyboard focus, zoom sizing, shared typography; no runtime errors or detail requests');
} finally {
  socket?.close();
  browser.kill();
  await server.close();
}
