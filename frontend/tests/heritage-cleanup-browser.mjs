// Real browser layout checks without an additional browser automation dependency.
// Run from frontend: node tests/heritage-cleanup-browser.mjs
// CHIS_TEST_CHROME can specify a Chromium executable on another machine.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, preview } from 'vite';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), 'chis-heritage-cleanup-browser-'));
const photo = join(profile, 'photo.png');
await writeFile(photo, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=', 'base64'));
const performanceMode = process.argv.includes('--performance');
const server = performanceMode ? await preview({ preview: { host: '127.0.0.1', port: 4175, strictPort: true } }) : await createServer({ server: { host: '127.0.0.1', port: 4175, strictPort: true } });
if (!performanceMode) await server.listen();
const browser = spawn(process.env.CHIS_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket, browserError, browserOutput = '';
const networkResponses = [];
browser.on('error', error => { browserError = error; });
browser.stderr.on('data', data => { browserOutput += data.toString(); });
const pending = new Map(); let sequence = 0;
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
  for (let attempt = 0; attempt < 500; attempt++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error('Browser condition timed out: ' + expression + '\n' + JSON.stringify(await evaluate('({text: document.body.innerText, requests: window.__requests, errors: window.__consoleErrors})')));
};
try {
  let debugPort;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (browserError) throw browserError;
    debugPort = browserOutput.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1];
    if (debugPort) break;
    await delay(100);
  }
  assert.ok(debugPort, 'Chrome starts with a debug port');
  const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Network.responseReceived') networkResponses.push({ url: message.params.response.url, status: message.params.response.status });
    const request = pending.get(message.id);
    if (request) { pending.delete(message.id); if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result); }
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await call('Page.navigate', { url: 'http://127.0.0.1:4175/tests/fixtures/heritage-cleanup.html' });
  await until("document.querySelector('#site-detail-name')");
  const assertLayout = async (selector, width) => {
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth && document.querySelector('${selector}').scrollWidth <= innerWidth`), true, `No overflow ${selector} at ${width}`);
  };
  const widths = [320,375,390,768,1024,1440];
  const openFromDetail = async () => {
    await evaluate("location.hash='#/heritage/1'; true"); await until("document.querySelector('#directions-btn')");
    await evaluate("document.querySelector('#directions-btn').click(); true"); await until("document.querySelector('#map-directions-panel') && document.querySelector('#san-fernando-real-map.leaflet-container')");
    assert.equal(await evaluate("location.hash"), '#/map?destination=1');
    assert.equal(await evaluate("document.querySelectorAll('.leaflet-container').length"), 1);
    assert.equal(await evaluate("Boolean(document.querySelector('#directions-modal-dialog'))"), false);
  };
  for (const width of widths) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await evaluate("location.hash='#/heritage/1'; true"); await until("document.querySelector('#site-detail-page')");
    await assertLayout('#site-detail-page', width);
    await evaluate("document.querySelector('#heritage-chatbot-trigger-btn').click(); true");
    await assertLayout('#heritage-chatbot-window', width);
    await evaluate("document.querySelector('#collapse-chatbot-btn').click(); true");
    await openFromDetail();
    assert.equal(await evaluate('window.__geoCalls'), 0);
    await assertLayout('#explore-map-combined-page', width);
    assert.equal(await evaluate("document.querySelector('#san-fernando-real-map').getBoundingClientRect().height >= 280"), true);
    await evaluate("document.querySelector('#use-current-location').scrollIntoView({block:'center'}); true");
    assert.equal(await evaluate("(() => { const b=document.querySelector('#use-current-location'),r=b.getBoundingClientRect(); return Boolean(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#use-current-location')); })()"), true);
    await evaluate("document.querySelector('#close-directions-btn').click(); true");
    console.log('PASS Site Detail and main-map route panel ' + width + 'px; no automatic GPS, one map, reachable location action');
  }
  await openFromDetail(); await evaluate("document.querySelector('#use-current-location').click(); true");
  await until("document.body.innerText.includes('Estimated driving time: 12 min') && document.querySelector('#san-fernando-real-map svg path')");
  assert.equal(await evaluate('window.__geoCalls'), 1);
  assert.ok((await evaluate("window.__requests.find(r=>r.url.includes('/route/v1/')).url")).includes('/120.67000,15.01000;120.69,15.03?overview=full&geometries=geojson&steps=true'));
  assert.equal(await evaluate("[...document.querySelectorAll('#san-fernando-real-map svg path')].some(path => (path.getAttribute('d')?.match(/L/g) || []).length >= 2)"), true);
  assert.equal(await evaluate("document.querySelector('#map-directions-panel').innerText.includes('Distance: 4.8 km') && document.querySelector('#map-directions-panel').innerText.includes('Turn right onto Fixture Road') && document.querySelector('#map-directions-panel').innerText.includes('Continue for 350 m')"), true);
  for (const width of widths) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await assertLayout('#explore-map-combined-page', width);
    assert.equal(await evaluate("document.querySelector('#san-fernando-real-map').getBoundingClientRect().height >= 280"), true);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[aria-label=\"Route preview steps\"]')).overflowY"), 'auto');
    console.log('PASS actual route geometry, metrics and scrollable steps ' + width + 'px');
  }
  await evaluate("document.querySelector('#close-directions-btn').click(); true");
  await until("!document.querySelector('#map-directions-panel')");
  assert.equal(await evaluate("document.querySelectorAll('.routing-start-marker').length"), 0);
  for (const [code,text] of [[1,'permission was denied'],[2,'current location is unavailable'],[3,'timed out']]) {
    const before = await evaluate("window.__requests.filter(r=>r.url.includes('/route/v1/')).length");
    await evaluate("window.__geoMode='" + code + "'; true"); await openFromDetail();
    await evaluate("document.querySelector('#use-current-location').click(); true");
    await until("document.querySelector('#map-directions-panel').innerText.includes('" + text + "')");
    assert.equal(await evaluate("window.__requests.filter(r=>r.url.includes('/route/v1/')).length"), before);
    await evaluate("document.querySelector('#close-directions-btn').click(); true");
  }
  await evaluate("window.__geoMode='success'; window.__routeMode='failure'; true"); await openFromDetail();
  await evaluate("document.querySelector('#use-current-location').click(); true");
  await until("document.body.innerText.includes('Road directions are temporarily unavailable.')");
  assert.equal(await evaluate("document.querySelector('#map-directions-panel').innerText.includes('Estimated driving time:')"), false);
  assert.equal(await evaluate("document.querySelectorAll('.routing-start-marker').length"), 1);
  await evaluate("document.querySelector('#close-directions-btn').click(); true");
  await until("document.querySelector('#map-card-directions-link')");
  await evaluate("document.querySelector('#map-card-directions-link').click(); true"); await until("document.querySelector('#map-directions-panel')");
  assert.equal(await evaluate('location.hash'), '#/map?destination=1');
  await evaluate("document.querySelector('#close-directions-btn').click(); document.querySelector('#heritage-chatbot-trigger-btn').click(); true");
  await evaluate("(() => {const i=document.querySelector('#heritage-chat-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'How do I get to the cathedral?'); i.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await evaluate("document.querySelector('#heritage-chat-input').closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); true");
  await until("[...document.querySelectorAll('#heritage-chatbot-window button')].some(b=>b.textContent==='Directions')");
  await evaluate("[...document.querySelectorAll('#heritage-chatbot-window button')].find(b=>b.textContent==='Directions').click(); true");
  await until("document.querySelector('#map-directions-panel')");
  assert.equal(await evaluate('location.hash'), '#/map?destination=1');
  await evaluate("document.querySelector('#close-directions-btn').click(); location.hash='#/explore'; true");
  await until("document.querySelector('#directory-directions-1')");
  for (const width of widths) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await assertLayout('#explore-map-combined-page', width); console.log('PASS heritage cards ' + width + 'px');
  }
  await evaluate("document.querySelector('#directory-directions-1').click(); true"); await until("document.querySelector('#map-directions-panel')");
  assert.equal(await evaluate("[...Object.keys(localStorage),...Object.keys(sessionStorage)].some(key=>/route|location|latitude|longitude/i.test(key))"), false);
  assert.equal(await evaluate("location.hash.includes('latitude') || location.hash.includes('longitude')"), false);
  console.log('PASS all shared Directions entry points, error cases, route close and no persisted location');
  assert.deepEqual(await evaluate('window.__consoleErrors'), []);

} finally {
  socket?.close(); browser.kill(); await server.close();
}
