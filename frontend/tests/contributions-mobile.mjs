// Real browser layout checks without an additional browser automation dependency.
// Run from frontend: node tests/contributions-mobile.mjs
// CHIS_TEST_CHROME can specify a Chromium executable on another machine.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, preview } from 'vite';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), 'chis-contributions-browser-'));
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
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
  if (process.argv.includes('--design')) {
    await call('Page.navigate', { url: 'http://127.0.0.1:4175/tests/fixtures/visitor-design.html' });
    await until("document.querySelector('#site-detail-name') && document.querySelector('#visitor-experiences') && !document.body.innerText.includes('Loading visitor experiences')");
    assert.equal(await evaluate("window.__requests.filter(r => r.url.endsWith('/passport')).length"), 0);
    assert.equal(await evaluate("window.__requests.filter(r => r.url.includes('/route/v1/')).length"), 0);
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Detail overflow ${width}`);
      console.log(`PASS archival Detail ${width}px`);
    }
    const detailShot = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(profile, 'detail.png'), Buffer.from(detailShot.data, 'base64'));
    await evaluate("window.scrollTo(0, 900); window.__beforePassportScroll = scrollY; true");
    await evaluate("document.querySelector('#header-profile-btn').click(); true");
    await until("document.body.innerText.includes('Traveler Profile')");
    await evaluate("document.querySelector('#profile-open-passport').click(); true");
    await until("document.querySelector('#passport-title') && document.body.innerText.includes('50% unlocked')");
    assert.equal(await evaluate("location.hash"), '#/heritage/1');
    await until("document.activeElement.id === 'passport-close'");
    assert.equal(await evaluate("document.querySelector('#san-fernando-app-root').inert"), true);
    assert.equal(await evaluate("document.body.style.overflow"), 'hidden');
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth && document.querySelector('[role=dialog]').scrollWidth <= innerWidth"), true, `Passport overflow ${width}`);
      console.log(`PASS archival Passport modal ${width}px`);
    }
    const passportShot = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(profile, 'passport.png'), Buffer.from(passportShot.data, 'base64'));
    console.log(JSON.stringify({ detailScreenshot: join(profile, 'detail.png'), passportScreenshot: join(profile, 'passport.png') }));
    await evaluate("document.querySelector('#passport-view button:last-child').focus(); true");
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"), true);
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await until("!document.querySelector('[role=dialog]') && document.activeElement.id === 'header-profile-btn' && scrollY === window.__beforePassportScroll");
    assert.equal(await evaluate('scrollY'), await evaluate('window.__beforePassportScroll'));
    console.log('PASS Passport focus, Escape, inert background and unchanged underlying route');
    await evaluate("document.querySelector('#header-profile-btn').click(); true");
    await until("document.body.innerText.includes('Traveler Profile')");
    await evaluate("document.querySelector('#profile-open-passport').click(); true");
    await until("document.querySelector('#passport-title')");
    assert.equal(await evaluate("window.__requests.filter(r => r.url.endsWith('/passport')).length"), 1);
    await evaluate("document.querySelector('#passport-close').click(); location.hash = '#/plan'; true");
    await until("document.querySelector('#open-itinerary-7')");
    await evaluate("document.querySelector('#open-itinerary-7').click(); true");
    await until("document.querySelector('#itinerary-map-toggle')");
    assert.equal(await evaluate("document.querySelector('#itinerary-route-summary').innerText.includes('Total stops') && document.querySelector('#itinerary-map-toggle').textContent === 'View Route on Map'"), true);
    for (const width of [320, 375, 390, 768, 1440]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Compact itinerary detail overflow ${width}`);
      console.log(`PASS Route Summary and compact stops ${width}px`);
    }
    assert.equal(await evaluate("window.__requests.filter(r => r.url.includes('/route/v1/')).length"), 0);
    await evaluate("document.querySelector('#itinerary-map-toggle').click(); true");
    await until("document.body.innerText.includes('12.4 km') && document.querySelector('.leaflet-overlay-pane path')");
    assert.equal(await evaluate("window.__requests.filter(r => r.url.includes('/route/v1/')).length"), 1);
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `OSRM map overflow ${width}`);
    }
    console.log('PASS on-demand OSRM map, estimates and responsive layout at all six widths');
    assert.deepEqual(await evaluate('window.__consoleErrors'), []);
  } else if (process.argv.includes('--runtime')) {
    const { identifier } = await call('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.clear(); window.__requests = []; window.__consoleErrors = [];
      const originalFetch = fetch, originalError = console.error;
      console.error = (...args) => { window.__consoleErrors.push(args.map(String).join(' ')); originalError(...args); };
      window.fetch = async (url, options) => {
        const entry = { url: String(url), start: performance.now() }; window.__requests.push(entry);
        const response = await originalFetch(url, options);
        entry.ms = performance.now() - entry.start; entry.status = response.status;
        entry.bytes = (await response.clone().arrayBuffer()).byteLength; return response;
      };` });
    await call('Page.navigate', { url: 'http://127.0.0.1:4175/#/plan' });
    await until("document.querySelector('[id^=open-itinerary-]')");
    console.log(JSON.stringify({ stage: 'plan-first', requests: await evaluate('window.__requests'), cardsMs: await evaluate("performance.now()"), leafletLoaded: await evaluate("performance.getEntriesByType('resource').some(r => /leafletRuntime/.test(r.name))") }));
    await evaluate("document.querySelector('[id^=open-itinerary-]').click(); true");
    await until("document.querySelector('#itinerary-map-toggle')");
    console.log(JSON.stringify({ stage: 'plan-detail', requests: await evaluate('window.__requests.filter(r => /itineraries/.test(r.url))') }));
    for (const width of [320, 375, 390, 768, 1440]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Plan ${width}px overflow`);
    }
    await evaluate("document.querySelector('#itinerary-map-toggle').click(); true");
    await until("performance.getEntriesByType('resource').some(r => /leafletRuntime/.test(r.name))");
    console.log('PASS live Plan loads Leaflet only on View on Map');
    await evaluate("location.hash = '#/home'; true"); await delay(400);
    await evaluate("window.__returnStart = performance.now(); const observer = new MutationObserver(() => { if (document.querySelector('[id^=open-itinerary-]')) { window.__returnMs = performance.now() - window.__returnStart; observer.disconnect(); } }); observer.observe(document.body, { childList: true, subtree: true }); location.hash = '#/plan'; true"); await until("document.querySelector('[id^=open-itinerary-]')");
    console.log(JSON.stringify({ stage: 'plan-return', cardsMs: await evaluate('window.__returnMs'), requests: await evaluate('window.__requests.filter(r => /itineraries/.test(r.url))') }));
    await evaluate("location.hash = '#/heritage/1'; true");
    await until("document.querySelector('#visitor-experiences') && !document.body.innerText.includes('Loading visitor experiences') && !document.body.innerText.includes('Loading visit verification')");
    console.log(JSON.stringify({ stage: 'detail', requests: await evaluate('window.__requests.filter(r => /heritage-sites\\/1/.test(r.url))'), consoleErrors: await evaluate('window.__consoleErrors') }));
    for (const width of [320, 375, 390, 768, 1440]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Detail ${width}px overflow`);
    }
    const beforeEvents = networkResponses.length;
    await evaluate("location.hash = '#/events'; true");
    await until("document.body.innerText.includes('Cultural Events & Festivals')");
    await evaluate("document.querySelectorAll('img').forEach(image => image.scrollIntoView()); true");
    await delay(1500);
    const eventImages = networkResponses.slice(beforeEvents).filter(r => /\/storage\/events\//.test(r.url));
    assert.equal(eventImages.some(r => r.status === 403), false);
    for (const url of new Set(eventImages.map(r => r.url))) assert.equal(eventImages.filter(r => r.url === url).length, 1, 'No broken event image retry loop');
    console.log(JSON.stringify({ stage: 'events-images', requests: eventImages, consoleErrors: await evaluate('window.__consoleErrors') }));
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  } else if (performanceMode) {
    for (const authenticated of [false, true, 'admin']) {
      await call('Page.navigate', { url: 'about:blank' });
      await until("location.href === 'about:blank'");
      const { identifier } = await call('Page.addScriptToEvaluateOnNewDocument', { source: `
        localStorage.clear();
        performance.setResourceTimingBufferSize(5000);
        ${authenticated ? "localStorage.setItem('chis_jwt_token', 'test-token');" : ''}
        window.__chisRequests = [];
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
          if (!String(url).startsWith('/api/')) return originalFetch(url, options);
          window.__chisRequests.push(String(url));
          const site = { id: 1, name: 'Recorded site', status: 'active', category: 'Churches', address: 'Address', latitude: 15, longitude: 120, description: 'Overview', history: 'Recorded history', images: [], timelines: [], visit_verification_enabled: false };
          const user = { id: 2, name: 'Visitor', email: 'visitor@example.test', role: ${JSON.stringify(authenticated === 'admin' ? 'admin' : 'traveler')} };
          const body = String(url).endsWith('/auth/me') ? { user }
            : String(url).endsWith('/passport') ? { total_points: 0, visited_count: 0, eligible_site_count: 0, visited_eligible_count: 0, visits: [], eligible_sites: [] }
            : String(url).endsWith('/admin/heritage-sites') ? []
            : String(url).endsWith('/heritage-sites') ? [{ id: site.id, name: site.name, status: site.status, category: site.category, address: site.address, latitude: site.latitude, longitude: site.longitude, short_description: 'Overview', cover_image: null }]
            : String(url).endsWith('/heritage-sites/1') ? site
            : String(url).endsWith('/check-in') ? { enabled: false }
            : String(url).endsWith('/contributions/mine') ? { active: true, verified: true, can_submit: true, contribution: null }
            : [];
          return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
        };` });
      await call('Page.navigate', { url: 'http://127.0.0.1:4175/#/home' });
      await until("document.querySelector('#app-main-footer') && window.__chisRequests?.includes('/api/events')");
      await delay(300);
      console.log(JSON.stringify({ authenticated, stage: 'startup', requests: await evaluate('window.__chisRequests') }));
      const optimized = process.argv.includes('--assert-optimized');
      if (optimized) {
        assert.equal(await evaluate("window.__chisRequests.filter(url => url === '/api/heritage-sites').length"), 1);
        assert.equal(await evaluate("window.__chisRequests.filter(url => url === '/api/events').length"), 1);
        assert.equal(await evaluate("window.__chisRequests.filter(url => url === '/api/auth/me').length"), authenticated ? 1 : 0);
        assert.equal(await evaluate("performance.getEntriesByType('resource').some(entry => /leafletRuntime|MapView-|AdminView-|SiteDetailView-|PassportView-/.test(entry.name))"), false);
      }
      for (const [view, label] of [['explore', 'Heritage Directory'], ['map', 'Interactive Heritage Map'], ['events', 'Cultural Events & Festivals']]) {
        const before = await evaluate('window.__chisRequests.length');
        await evaluate(`[...document.querySelectorAll('#app-main-footer button')].find(button => button.textContent.trim() === ${JSON.stringify(label)}).click(); true`);
        await until(`location.hash === '#/${view}'`); await delay(300);
        console.log(JSON.stringify({ authenticated, stage: view, requests: await evaluate(`window.__chisRequests.slice(${before})`) }));
        if (optimized) {
          assert.deepEqual(await evaluate(`window.__chisRequests.slice(${before})`), []);
          if (view === 'explore') assert.equal(await evaluate("performance.getEntriesByType('resource').some(entry => /leafletRuntime/.test(entry.name))"), false);
          if (view === 'map') await until("document.querySelector('.leaflet-container')");
        }
      }
      if (optimized) {
        const before = await evaluate('window.__chisRequests.length');
        await evaluate("location.hash = '#/heritage/1'; true");
        await until("document.querySelector('#visitor-experiences')");
        console.log(JSON.stringify({ authenticated, stage: 'detail', requests: await evaluate(`window.__chisRequests.slice(${before})`) }));
        assert.equal(await evaluate("window.__chisRequests.filter(url => url === '/api/heritage-sites/1/contributions').length"), 1);
        if (authenticated === 'admin') {
          await evaluate("location.hash = '#/admin'; true");
          await until("document.querySelector('.admin-shell')");
          assert.ok(await evaluate("performance.getEntriesByType('resource').some(entry => /AdminView-/.test(entry.name))"));
        }
        console.log(JSON.stringify({ authenticated, modules: await evaluate("performance.getEntriesByType('resource').filter(entry => /\\/assets\\/.*\\.js/.test(entry.name)).map(entry => entry.name.split('/').pop())") }));
      }
      await call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    }
  } else {
  for (const mode of (process.argv.includes('--checkins') ? ['checkins'] : ['guest', 'unverified', 'visitor', 'admin', 'verification', 'verification-legacy'])) {
    await call('Page.navigate', { url: `http://127.0.0.1:4175/tests/fixtures/contributions.html?mode=${mode}` });
    if (mode === 'checkins') await until("document.querySelectorAll('#admin-checkins form').length === 4");
    else await until(`document.querySelector('img') && document.body.innerText.includes(${JSON.stringify(mode === 'admin' ? 'Official landmark' : mode === 'visitor' ? 'Share Your Experience' : mode === 'guest' ? 'Sign in to share your experience.' : 'Verify your visit before sharing an experience.')})`);
    if (mode === 'visitor') {
      await call('DOM.enable');
      const { root } = await call('DOM.getDocument');
      const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector: '#contribution-photos' });
      await call('DOM.setFileInputFiles', { nodeId, files: [photo, photo, photo] });
      await until("document.body.innerText.includes('3 of 3 photos selected')");
    }
    for (const width of [320, 375, 390, 768, 1440]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      await delay(100);
      const layout = await evaluate(`({ viewport: innerWidth, scroll: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll('form,img,input,textarea,article')].filter(element => {
          const bounds = element.getBoundingClientRect(); return bounds.left < -1 || bounds.right > innerWidth + 1;
        }).map(element => element.tagName + '#' + element.id) })`);
      assert.ok(layout.scroll <= layout.viewport, `${mode} at ${width}px: page overflow ${JSON.stringify(layout)}`);
      assert.deepEqual(layout.overflowing, [], `${mode} at ${width}px: controls and photos stay inside viewport`);
      console.log(`PASS ${mode} layout ${width}px`);
    }
    if (mode === 'visitor') {
      await evaluate("document.querySelector('#contribution-form').requestSubmit(); true");
      await until("document.body.innerText.includes('Your contribution is awaiting review.')");
      console.log('PASS browser upload submission');
    }
    if (mode === 'checkins') {
      assert.equal(await evaluate("document.querySelector('#checkin-enabled-3').disabled && document.querySelector('#checkin-enabled-4').disabled"), true);
      await evaluate("document.querySelector('#checkin-enabled-2').click(); true");
      await until("!document.querySelector('#checkin-save-2').disabled");
      await evaluate("document.querySelector('#checkin-site-2').requestSubmit(); true");
      await until("document.body.innerText.includes('Visit verification updated.')");
      assert.equal(await evaluate('window.__configSaves'), 1);
      assert.equal(await evaluate('window.__configListRequests'), 1);
      assert.equal(await evaluate("document.querySelector('#checkin-enabled-2').getAttribute('aria-checked')"), 'true');
      assert.equal(await evaluate("document.querySelector('#checkin-save-2').disabled"), true);
      console.log('PASS Admin verification all-site manager saves locally without list refetch');
    }
    if (mode === 'admin') {
      await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'Approve').click(); true");
      await until("document.body.innerText.includes('Contribution approved.')");
      await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'Approved').click(); true");
      await until("document.querySelector('article') && document.body.innerText.includes('Reject')");
      await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'Reject').click(); true");
      await until("document.body.innerText.includes('Contribution rejected.')");
      console.log('PASS browser approve/reject moderation');
    }
    if (mode.startsWith('verification')) {
      await until("[...document.querySelectorAll('#visitor-experiences button')].some(button => button.textContent.includes('Verify My Visit'))");
      assert.equal(await evaluate('window.__availabilityRequests'), mode === 'verification-legacy' ? 1 : 0);
      await call('Browser.grantPermissions', { origin: 'http://127.0.0.1:4175', permissions: ['geolocation'] });
      await call('Emulation.setGeolocationOverride', { latitude: 15.03, longitude: 120.69, accuracy: 10 });
      await evaluate("document.querySelector('#visitor-experiences button').click(); true");
      await until("document.body.innerText.includes('Visit Verified') && document.querySelector('#contribution-form')");
      assert.equal(await evaluate('window.__geoCalls'), 1);
      assert.equal(await evaluate('window.__passportRefreshes'), 1);
      console.log('PASS contribution CTA reaches real browser geolocation, refreshes eligibility and Passport callback');
    }
  }
  }
} finally {
  socket?.close();
  browser.kill();
  if (performanceMode) await new Promise(resolve => server.httpServer.close(resolve));
  else await server.close();
}
