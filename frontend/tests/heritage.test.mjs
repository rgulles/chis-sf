import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test, { beforeEach } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const imageModuleUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(read('../src/utils/heritageImages.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText).toString('base64')}`;
const compile = (source, module = ts.ModuleKind.CommonJS) => ts.transpileModule(source.replace(/(['"'])(?:\.\.\/utils\/heritageImages|\.\/heritageImages)\1/g, JSON.stringify(imageModuleUrl)), {
  compilerOptions: { module, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const load = path => import(`data:text/javascript;base64,${Buffer.from(compile(read(path), ts.ModuleKind.ESNext)).toString('base64')}`);
const navigation = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/utils/heritageNavigation.ts'), ts.ModuleKind.ESNext)).toString('base64')}`);
const api = await load('../src/api/client.ts');
const imageHelpers = await import(imageModuleUrl);
const coordinates = await load('../src/utils/heritageCoordinates.ts');
const chatEngine = await load('../src/data/heritageChatEngine.ts');
const categories = ['All', 'Historical Buildings', 'Churches', 'Museums', 'Monuments', 'Cultural Sites'];
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const tick = () => new Promise(resolve => setImmediate(resolve));

beforeEach(() => {
  const storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
});

test('mapper preserves unknown coordinates and real status without inventing status', async () => {
  const values = [
    {}, { latitude: null, longitude: null }, { latitude: '15', longitude: null },
    { latitude: '', longitude: '120' }, { latitude: 'oops', longitude: '120' },
    { latitude: 91, longitude: 120 }, { latitude: 15, longitude: 181 },
  ];
  fetch = async () => reply(values.map((value, id) => ({ id, name: 'Site', status: 'active', ...value })));
  const sites = await api.apiFetchSites();
  for (const site of sites) {
    assert.equal(site.coordinates, null);
    assert.equal(site.status, 'active');
  }
  fetch = async () => reply([{ id: 1, latitude: '0.00000000', longitude: '0.00000000' }]);
  const [zero] = await api.apiFetchSites();
  assert.equal(zero.coordinates.lat, 0);
  assert.equal(zero.coordinates.lng, 0);
  assert.equal(zero.status, undefined);
});

test('API distinguishes valid empty catalogue from HTTP, network and malformed failures', async () => {
  fetch = async () => reply([]);
  assert.deepEqual(await api.apiFetchSites(), []);
  for (const request of [
    async () => reply([], 500),
    async () => { throw new Error('offline'); },
    async () => reply({ sites: [] }),
    async () => new Response('<html>error</html>'),
  ]) {
    fetch = request;
    await assert.rejects(api.apiFetchSites(), /Unable to load heritage sites/);
  }
});

test('Admin reads use protected all-status routes and preserve archived status', async () => {
  localStorage.setItem('chis_jwt_token', 'admin-token');
  const requests = [];
  fetch = async (url, options) => {
    requests.push([url, options.headers.Authorization]);
    return reply([{ id: 1, status: 'archived' }]);
  };
  assert.equal((await api.apiFetchRawSites())[0].status, 'archived');
  await api.apiFetchSiteImages();
  assert.deepEqual(requests, [
    ['/api/admin/heritage-sites', 'Bearer admin-token'],
    ['/api/admin/site-images', 'Bearer admin-token'],
  ]);
});

function walk(node, callback) {
  if (Array.isArray(node)) return node.forEach(child => walk(child, callback));
  if (!node || typeof node !== 'object') return;
  callback(node);
  walk(node.props?.children, callback);
}
function find(node, predicate) {
  let found;
  walk(node, child => { if (!found && predicate(child)) found = child; });
  return found;
}
function harness(path, exportName, initialProps = {}, modules = {}) {
  let props = initialProps;
  const slots = [], effects = [];
  let cursor = 0, pending = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(callback) { cursor++; return callback(); },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = effects[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        pending.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const exports = {}, stubs = new Map();
  vm.runInNewContext(compile(read(path)), {
    exports, console, Error, localStorage, sessionStorage, setTimeout: () => 1, clearTimeout() {},
    window: modules.__window || { scrollTo() {} }, navigator: modules.__navigator || {}, URL,
    require(name) {
      if (name === imageModuleUrl) return imageHelpers;
      if (name.endsWith('/data/heritageChatEngine')) return chatEngine;
      if (name.endsWith('/utils/heritageNavigation')) return navigation;
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (modules[name]) return modules[name];
      if (name.endsWith('/utils/heritageCoordinates')) return coordinates;
      if (name.endsWith('/data/heritageCategories')) return { HERITAGE_CATEGORIES: categories };
      if (name === 'canvas-confetti') return { default() {} };
      if (!stubs.has(name)) stubs.set(name, new Proxy({}, { get: (_, key) =>
        Object.assign(() => null, { displayName: String(key) }) }));
      return stubs.get(name);
    },
  });
  return {
    render(nextProps = props) {
      props = nextProps; cursor = 0;
      const tree = exports[exportName](props);
      walk(tree, node => { if (node.props?.ref && typeof node.props.ref === 'object') node.props.ref.current = { scrollIntoView() {}, focus() {} }; });
      return tree;
    },
    flush() { const callbacks = pending; pending = []; callbacks.forEach(callback => callback()); },
  };
}

const rawSite = { id: 1, name: 'Live site', status: 'active', category: 'Churches', latitude: 15, longitude: 120 };
async function mappedSite() {
  fetch = async () => reply([rawSite]);
  return (await api.apiFetchSites())[0];
}

for (const failure of [false, true]) {
  test(`App clears loaded catalogue and selected detail on ${failure ? 'failure with visible error' : 'successful empty response'}`, async () => {
    const site = await mappedSite();
    let calls = 0;
    const view = harness('../src/App.tsx', 'default', {}, {
      './api/client': { ...api, apiFetchCurrentUser: async () => null, apiFetchEvents: async () => [],
        apiFetchSites: async () => {
          if (++calls === 1) return [site];
          if (failure) throw new Error('Unable to load heritage sites. Please try again.');
          return [];
        } },
    });
    view.render(); view.flush(); await tick();
    let tree = view.render();
    const home = find(tree, node => node.type?.displayName === 'HomeView');
    assert.equal(home.props.featuredSites.length, 1);
    home.props.onSelectSite(site);
    tree = view.render();
    assert.equal(find(tree, node => node.type?.displayName === 'SiteDetailView'), undefined);
    view.flush(); await tick();
    tree = view.render();
    assert.equal(find(tree, node => node.type?.displayName === 'SiteDetailView'), undefined);
    assert.equal(Boolean(find(tree, node => node.props?.role === 'alert')), failure);
    const header = find(tree, node => node.type?.displayName === 'Header');
    header.props.onNavigate('home');
    tree = view.render();
    assert.equal(find(tree, node => node.type?.displayName === 'HomeView').props.featuredSites.length, 0);
  });
}

test('Map never sends missing, NaN or out-of-range site coordinates to Leaflet; filtered card clears', async () => {
  const good = await mappedSite();
  const markerPositions = [], moves = [];
  const map = { remove() {}, removeLayer() {}, addLayer() {}, setView: pos => moves.push(pos), panTo: pos => moves.push(pos) };
  const layer = () => ({ addTo() { return this; }, remove() {}, on() { return this; } });
  const leaflet = { map: () => map, tileLayer: layer, polygon: layer, polyline: layer, divIcon: value => value,
    marker: pos => { markerPositions.push(pos); return layer(); } };
  const bad = [null, { lat: NaN, lng: 120 }, { lat: 15, lng: Infinity }, { lat: 91, lng: 120 }, { lat: 15, lng: -181 }];
  const sites = [good, ...bad.map((value, index) => ({ ...good, id: String(index + 2), coordinates: value }))];
  const props = { sites, onSelectSite() {}, onPlanRoute() {}, savedSiteIds: [], onToggleSaveSite() {}, initialViewMode: 'map', selectedCategory: 'All' };
  const view = harness('../src/views/MapView.tsx', 'MapView', props, { leaflet, 'motion/react': { motion: new Proxy({}, { get: (_, key) => key }), AnimatePresence: () => null } });
  view.render(); view.flush();
  assert.deepEqual(markerPositions.map(pos => Array.from(pos)), [[15, 120]]);
  let tree = view.render();
  assert.ok(find(tree, node => node.props?.id === 'map-floating-site-card'));
  const invalidChip = find(tree, node => node.props?.id === 'quick-jump-2');
  invalidChip.props.onClick();
  tree = view.render();
  assert.equal(find(tree, node => node.props?.id === 'map-card-directions-link'), undefined);
  assert.equal(moves.length, 0);
  tree = view.render({ ...props, selectedCategory: 'Museums' });
  assert.equal(find(tree, node => node.props?.id === 'map-floating-site-card'), undefined);
  view.flush();
  assert.equal(find(view.render(), node => node.props?.id === 'map-floating-site-card'), undefined);
});

test('Site Detail disables directions and DirectionsModal refuses unknown location', async () => {
  const site = { ...await mappedSite(), coordinates: null };
  const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site });
  assert.equal(find(view.render(), node => node.props?.id === 'directions-btn').props.disabled, true);
  const modal = harness('../src/components/DirectionsModal.tsx', 'DirectionsModal', { isOpen: true, site });
  assert.equal(modal.render(), null);
});

function renderedText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderedText).join(' ');
  return node?.props ? renderedText(node.props.children) : '';
}

test('visitor mapper uses only saved fields and keeps null/missing values unknown', async () => {
  const values = { opening_hours: ' Weekdays by appointment ', entrance_fee: 'Admission on request',
    accessibility_notes: 'Ground floor only', visit_notes: 'Call before visiting', contact_information: 'Office contact' };
  fetch = async () => reply([{ ...rawSite, ...values }, { ...rawSite, id: 2 },
    { ...rawSite, id: 3, opening_hours: null, entrance_fee: '', accessibility_notes: '  ', visit_notes: null, contact_information: null }]);
  const [populated, missing, empty] = await api.apiFetchSites();
  assert.deepEqual(populated.visitInfo, {
    address: '', openingHours: 'Weekdays by appointment', entranceFee: 'Admission on request',
    accessibilityNotes: 'Ground floor only', visitNotes: 'Call before visiting', contactInformation: 'Office contact',
  });
  for (const site of [missing, empty]) {
    for (const field of ['openingHours', 'entranceFee', 'accessibilityNotes', 'visitNotes', 'contactInformation']) {
      assert.equal(site.visitInfo[field], null);
    }
  }
  for (const site of [populated, missing, empty]) {
    for (const field of ['accessibility', 'duration', 'guideAvailable', 'bestTime']) assert.equal(field in site.visitInfo, false);
  }
});

test('Site Detail displays saved visitor rows as text and hides blank rows/section', async () => {
  const site = await mappedSite();
  const visitInfo = { address: '', openingHours: 'Weekdays\nBy appointment', entranceFee: 'Free admission',
    accessibilityNotes: 'Ground floor only', visitNotes: 'Call first', contactInformation: '<script>plain text</script>' };
  const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site: { ...site, visitInfo } });
  let section = find(view.render(), node => node.props?.id === 'section-visitor-information');
  const content = renderedText(section);
  for (const value of Object.values(visitInfo).filter(Boolean)) assert.ok(content.includes(value));
  assert.equal(find(section, node => node.props?.dangerouslySetInnerHTML), undefined);
  let rows = [];
  walk(section, node => { if (node.type === 'dt') rows.push(renderedText(node)); });
  assert.equal(rows.length, 5);
  section = find(view.render({ site: { ...site, visitInfo: { address: '', visitNotes: 'Appointment required',
    openingHours: null, entranceFee: '', accessibilityNotes: '  ' } } }), node => node.props?.id === 'section-visitor-information');
  rows = [];
  walk(section, node => { if (node.type === 'dt') rows.push(renderedText(node)); });
  assert.deepEqual(rows, ['Visit Notes']);
  assert.equal(find(view.render({ site }), node => node.props?.id === 'section-visitor-information'), undefined);
});

test('Home never displays an unsupported visit duration or a replacement default', async () => {
  const site = { ...await mappedSite(), visitInfo: { address: '', duration: 'unsupported duration' } };
  const view = harness('../src/views/HomeView.tsx', 'HomeView', { featuredSites: [site], upcomingEvents: [], savedSiteIds: [] }, {
    'motion/react': { motion: new Proxy({}, { get: (_, key) => key }) },
  });
  const text = renderedText(view.render());
  assert.equal(text.includes('unsupported duration'), false);
  assert.equal(text.includes('45 mins'), false);
  assert.equal(text.includes('1 hr'), false);
});

test('image URLs share Admin normalization and neutral fallback without repeated errors', () => {
  for (const path of ['http://example.test/photo.jpg', 'https://example.test/photo.jpg', '//example.test/photo.jpg', '/images/photo.jpg']) {
    assert.equal(imageHelpers.heritageImageUrl(path), path);
  }
  for (const path of ['heritage/photo.jpg', '/storage/heritage/photo.jpg', 'storage/heritage/photo.jpg']) {
    assert.equal(imageHelpers.heritageImageUrl(path), '/storage/heritage/photo.jpg');
    assert.equal(imageHelpers.heritageImageUrl(path, 'https://backend.test/api/'), 'https://backend.test/storage/heritage/photo.jpg');
  }
  assert.equal(imageHelpers.heritageImageUrl(' '), imageHelpers.HERITAGE_IMAGE_PLACEHOLDER);
  assert.ok(read('../public/images/heritage-placeholder.svg').includes('Image unavailable'));
  let src = '/broken.jpg', changes = 0;
  const img = { getAttribute: () => src, onerror() {}, set src(value) { src = value; changes++; } };
  imageHelpers.handleHeritageImageError({ currentTarget: img });
  imageHelpers.handleHeritageImageError({ currentTarget: img });
  assert.equal(src, imageHelpers.HERITAGE_IMAGE_PLACEHOLDER);
  assert.equal(changes, 1);
});

test('mapper retains all ordered image references and captions; explicit cover wins over order', async () => {
  const images = [
    { id: 4, image_path: 'four.jpg', caption: 'Fourth', sort_order: 4 },
    { id: 3, image_path: 'https://example.test/cover.jpg', caption: 'Cover', is_cover: true, sort_order: 3 },
    { id: 2, image_path: '/images/two.jpg', caption: 'Second', sort_order: 0 },
    { id: 1, image_path: '/storage/one.jpg', caption: null, sort_order: 0 },
  ];
  fetch = async () => reply([{ ...rawSite, images }]);
  const [site] = await api.apiFetchSites();
  assert.equal(site.heroImage, 'https://example.test/cover.jpg');
  assert.deepEqual(site.images.map(image => image.id), ['1', '2', '3', '4']);
  assert.equal(site.images[3].caption, 'Fourth');
  assert.equal(site.images[2].isCover, true);
  assert.equal(site.images[2].sortOrder, 3);
  assert.equal(site.archivalImage, '');
  assert.equal(site.modernImage, '');
  assert.equal(site.thenNowCaption, '');
  fetch = async () => reply([{ ...rawSite, images: images.map(image => ({ ...image, is_cover: false })) }, { ...rawSite, id: 2, images: [] }]);
  const [noCover, noImages] = await api.apiFetchSites();
  assert.equal(noCover.heroImage, '/storage/one.jpg');
  assert.equal(noImages.heroImage, imageHelpers.HERITAGE_IMAGE_PLACEHOLDER);
  assert.deepEqual(noImages.images, []);
});

test('Site Detail gallery excludes main image and displays every additional caption without image roles', async () => {
  fetch = async () => reply([{ ...rawSite, images: [
    { id: 1, image_path: 'one.jpg', caption: 'Main caption', is_cover: true },
    { id: 2, image_path: 'two.jpg', caption: 'Additional caption' },
    { id: 3, image_path: 'three.jpg' }, { id: 4, image_path: 'four.jpg', caption: 'Fourth caption' },
  ] }]);
  const [site] = await api.apiFetchSites();
  const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site });
  const tree = view.render();
  const gallery = find(tree, node => node.props?.id === 'section-site-gallery');
  const figures = [];
  walk(gallery, node => { if (node.type === 'figure') figures.push(node); });
  assert.equal(figures.length, 3);
  assert.ok(renderedText(gallery).includes('Additional caption'));
  assert.ok(renderedText(gallery).includes('Fourth caption'));
  assert.ok(renderedText(tree).includes('Main caption'));
  assert.equal(find(tree, node => node.props?.id === 'section-then-now'), undefined);
  assert.equal(renderedText(gallery).includes('Archival'), false);
  assert.equal(find(view.render({ site: { ...site, images: [site.images[0]] } }), node => node.props?.id === 'section-site-gallery'), undefined);
});

function browserAt(hash = '') {
  const entries = [{ hash, state: null }]; let index = 0;
  const listeners = new Map();
  const browser = { location: { hash, href: 'https://chis.test/' + hash }, scrollTo() {},
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    history: {
      get state() { return entries[index].state; },
      pushState(state, unused, hash) { entries.splice(index + 1); entries.push({ hash, state }); index++; sync(); },
      back() { if (index > 0) { index--; sync(); emit(); } },
      forward() { if (index < entries.length - 1) { index++; sync(); emit(); } },
    },
  };
  function sync() { browser.location.hash = entries[index].hash; browser.location.href = 'https://chis.test/' + entries[index].hash; }
  function emit() { listeners.get('popstate')?.(); listeners.get('hashchange')?.(); }
  return browser;
}
function appFor(browser, lookup, sites = []) {
  return harness('../src/App.tsx', 'default', {}, { __window: browser,
    './api/client': { ...api, apiFetchCurrentUser: async () => null, apiFetchEvents: async () => [],
      apiFetchSites: async () => sites, apiFetchSiteById: lookup } });
}
const detailNode = tree => find(tree, node => node.type?.displayName === 'SiteDetailView');
function allText(tree) { let output = ''; walk(tree, node => { const children = node.props?.children; if (typeof children === 'string') output += children; else if (Array.isArray(children)) output += children.filter(child => typeof child === 'string').join(' '); }); return output; }

test('direct heritage URLs load independently, refresh, and keep coherent back/forward navigation', async () => {
  const site = await mappedSite(); const browser = browserAt(); const requests = [];
  const lookup = async id => { requests.push(id); return site; };
  const view = appFor(browser, lookup, [site]);
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.type?.displayName === 'Header').props.onNavigate('explore');
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.type?.displayName === 'ExploreView').props.onSelectSite(site);
  assert.equal(browser.location.hash, '#/heritage/1');
  assert.equal(detailNode(view.render()), undefined);
  view.flush(); await tick();
  assert.equal(detailNode(view.render()).props.site.id, '1');
  assert.deepEqual(requests, ['1']);
  // Reopening the same URL must refresh instead of remaining stuck in loading.
  find(view.render(), node => node.type?.displayName === 'SearchModal').props.onSelectSite(site);
  view.render(); view.flush(); await tick();
  assert.equal(detailNode(view.render()).props.site.id, '1');
  detailNode(view.render()).props.onBack();
  assert.equal(browser.location.hash, '#/explore');
  assert.ok(find(view.render(), node => node.type?.displayName === 'ExploreView'));
  view.flush(); await tick();
  browser.history.forward(); view.render(); view.flush(); await tick();
  assert.equal(detailNode(view.render()).props.site.id, '1');
  // A fresh component instance (refresh/new tab) uses just the URL and direct endpoint.
  const refreshed = appFor(browserAt(browser.location.hash), lookup);
  assert.ok(allText(refreshed.render()).includes('Loading heritage site'));
  refreshed.flush(); await tick();
  assert.equal(detailNode(refreshed.render()).props.site.id, '1');
});

test('invalid, nonexistent and archived direct URLs are unavailable; request failures are retryable', async () => {
  for (const hash of ['#/heritage/nope', '#/heritage/0', '#/heritage/999']) {
    let calls = 0; const view = appFor(browserAt(hash), async () => { calls++; return null; });
    view.render(); view.flush(); await tick();
    assert.equal(detailNode(view.render()), undefined);
    assert.ok(allText(view.render()).includes('Heritage site not found'));
    assert.equal(calls, hash.endsWith('999') ? 1 : 0);
  }
  const site = await mappedSite(); let failed = true;
  const view = appFor(browserAt('#/heritage/1'), async () => { if (failed) throw new Error('offline'); return site; });
  view.render(); view.flush(); await tick();
  assert.ok(allText(view.render()).includes('Unable to load this heritage site'));
  failed = false;
  find(view.render(), node => node.type === 'button' && node.props.children === 'Try again').props.onClick();
  view.render(); view.flush(); await tick();
  assert.equal(detailNode(view.render()).props.site.id, '1');
});

test('direct API keeps archived/404 unavailable and distinguishes network, server and malformed errors', async () => {
  fetch = async () => reply({}, 404); assert.equal(await api.apiFetchSiteById('1'), null);
  for (const request of [async () => reply({}, 500), async () => { throw new Error('offline'); },
    async () => reply({ id: 2, status: 'active' }), async () => reply({ id: 1, status: 'archived' })]) {
    fetch = request; await assert.rejects(api.apiFetchSiteById('1'), /Unable to load this heritage site/);
  }
  fetch = async url => { assert.equal(url, '/api/heritage-sites/1'); return reply({ ...rawSite, timelines: [{ year: 'circa 1800', title: 'Early', description: 'History', sort_order: 0 }], opening_hours: 'Saved hours', images: [{ id: 1, image_path: 'heritage-sites/live.jpg', caption: 'Saved caption' }] }); };
  const site = await api.apiFetchSiteById('1');
  assert.equal(site.timeline[0].year, 'circa 1800'); assert.equal(site.visitInfo.openingHours, 'Saved hours'); assert.equal(site.images[0].caption, 'Saved caption');
});

test('superseded detail requests cannot show the previous site', async () => {
  const site = await mappedSite(); const browser = browserAt('#/heritage/1'); let finish;
  const view = appFor(browser, id => id === '1' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ ...site, id: '2' }));
  view.render(); view.flush();
  find(view.render(), node => node.type?.displayName === 'SearchModal').props.onSelectSite({ ...site, id: '2' });
  assert.equal(detailNode(view.render()), undefined); view.flush(); await tick();
  assert.equal(detailNode(view.render()).props.site.id, '2');
  finish(site); await tick(); assert.equal(detailNode(view.render()).props.site.id, '2');
});

test('share uses exact heritage URL and reports only fulfilled share/copy operations', async () => {
  const site = await mappedSite(); const shared = [];
  for (const native of [true, false]) {
    const nav = native ? { share: async data => shared.push(data.url) } : { clipboard: { writeText: async url => shared.push(url) } };
    const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site }, { __window: browserAt('#/explore'), __navigator: nav });
    await find(view.render(), node => node.props?.id === 'detail-share-btn').props.onClick();
    assert.equal(shared.at(-1), 'https://chis.test/#/heritage/1');
    assert.ok(allText(view.render()).includes(native ? 'Shared' : 'Link copied'));
  }
  const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site }, { __window: browserAt(), __navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } } });
  await find(view.render(), node => node.props?.id === 'detail-share-btn').props.onClick();
  assert.ok(allText(view.render()).includes('Unable to share')); assert.equal(allText(view.render()).includes('Link copied'), false);
});

test('core Site Detail hides unsupported content even when legacy properties contain mock data', async () => {
  const site = { ...await mappedSite(), nativeName: 'Live site', yearBuilt: 'Unknown', era: 'Fake era', archivalImage: 'old.jpg', modernImage: 'new.jpg',
    audioStory: { durationSeconds: 100 }, householdVaults: [{ id: 'vault' }], didYouKnow: [], visitInfo: { entranceFee: 'Saved admission' },
    timeline: [{ year: 'circa 1900', title: 'Recorded milestone', description: 'Saved history' }] };
  const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site }); const tree = view.render();
  for (const id of ['deep-dive-story-btn', 'section-then-now', 'section-household-vaults', 'section-did-you-know']) assert.equal(find(tree, node => node.props?.id === id), undefined);
  for (const component of ['AudioStoryPlayer', 'VisitorPhotoWall', 'ThenNowSlider']) assert.equal(find(tree, node => node.type?.displayName === component), undefined);
  assert.equal(allText(tree).includes('Fake era'), false); assert.equal(allText(tree).includes('Unknown'), false);
  assert.ok(allText(tree).includes('Saved admission')); assert.ok(allText(tree).includes('Recorded milestone'));
});


test('public timeline keeps backend order instead of sorting display years lexically', async () => {
  const timelines = [
    { id: 5, sort_order: 0, year: 'circa 1900', title: 'First ordered', description: 'First description' },
    { id: 2, sort_order: 1, year: '1800', title: 'Second ordered', description: 'Second description' },
  ];
  fetch = async () => reply({ ...rawSite, timelines });
  const site = await api.apiFetchSiteById('1');
  assert.deepEqual(site.timeline.map(item => item.title), ['First ordered', 'Second ordered']);
  const tree = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site }).render();
  const content = allText(tree);
  assert.ok(content.indexOf('First ordered') < content.indexOf('Second ordered'));
  assert.ok(content.includes('circa 1900')); assert.ok(content.includes('Second description'));
  assert.equal(find(tree, node => node.props?.id === 'section-about-place'), undefined);
});

test('view URLs preserve Events navigation and verified Admin access', async () => {
  const events = [{ id: '8', title: 'Existing event' }];
  const eventView = harness('../src/App.tsx', 'default', {}, { __window: browserAt('#/events'),
    './api/client': { ...api, apiFetchSites: async () => [], apiFetchEvents: async () => events, apiFetchCurrentUser: async () => null } });
  eventView.render(); eventView.flush(); await tick();
  assert.equal(find(eventView.render(), node => node.type?.displayName === 'EventsView').props.events, events);
  const browser = browserAt('#/admin');
  const adminView = harness('../src/App.tsx', 'default', {}, { __window: browser,
    './api/client': { ...api, apiFetchSites: async () => [], apiFetchEvents: async () => [], apiFetchCurrentUser: async () => ({ id: '1', role: 'admin' }) } });
  assert.equal(find(adminView.render(), node => node.type?.displayName === 'AdminView'), undefined);
  adminView.flush(); await tick();
  assert.ok(find(adminView.render(), node => node.type?.displayName === 'AdminView'));
});


test('live mapper has no fabricated tourism fields and unknown textual information stays empty', async () => {
  fetch = async () => reply([{ id: 1, name: 'Live', category: 'Museums', status: 'active' }]);
  const [site] = await api.apiFetchSites();
  for (const key of ['era', 'nativeName', 'barangay', 'distanceKm', 'audioStory', 'qrCodeId', 'scanCount', 'badgeName']) assert.equal(key in site, false, key);
  for (const key of ['yearBuilt', 'address', 'shortDescription', 'fullDescription', 'story']) assert.equal(site[key], '');
  assert.equal(site.heroImage, imageHelpers.HERITAGE_IMAGE_PLACEHOLDER);
  fetch = async () => reply([{ ...rawSite, latitude: 15, longitude: 120 }]);
  assert.deepEqual(Object.keys((await api.apiFetchSites())[0].coordinates), ['lat', 'lng']);
});

const motionModule = { motion: new Proxy({}, { get: (_, key) => key }), AnimatePresence: 'div' };

test('Home uses each real cover and matching highlight copy without fetching global images', async () => {
  const first = { ...await mappedSite(), heroImage: '/images/first.jpg', name: 'First live site', shortDescription: 'First saved overview', address: 'First address', yearBuilt: '' };
  const second = { ...first, id: '2', heroImage: '/images/second.jpg', name: 'Second live site', shortDescription: 'Second saved overview' };
  let requests = 0; fetch = async () => { requests++; throw new Error('No global image requests'); };
  const props = { featuredSites: [first, second], upcomingEvents: [], savedSiteIds: [], onToggleSaveSite() {} };
  const view = harness('../src/views/HomeView.tsx', 'HomeView', props, { 'motion/react': motionModule });
  let tree = view.render(); view.flush(); await tick();
  assert.equal(requests, 0);
  assert.ok(find(tree, node => node.type === 'img' && node.props.src === '/images/first.jpg' && node.props.alt === first.name));
  assert.ok(find(tree, node => node.type === 'img' && node.props.src === '/images/second.jpg' && node.props.alt === second.name));
  assert.ok(allText(tree).includes('First saved overview')); assert.equal(allText(tree).includes('The Parul Sampernandu Tradition'), false);
  assert.equal(allText(tree).includes('Circa'), false);
  tree = view.render({ ...props, featuredSites: [] });
  assert.ok(allText(tree).includes('No heritage sites are currently available.'));
  assert.ok(find(tree, node => node.type === 'img' && node.props.src === imageHelpers.HERITAGE_IMAGE_PLACEHOLDER));
});

test('directory hides distance, audio, QR, Nearby, popularity, fake native names and unknown dates', async () => {
  const site = { ...await mappedSite(), nativeName: 'Live site', yearBuilt: '', distanceKm: 0, scanCount: 999, qrCodeId: 'fake-qr', era: 'Fake era', audioStory: {} };
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [site], savedSiteIds: [], selectedCategory: 'All' }, { 'motion/react': motionModule });
  const tree = view.render(); const content = allText(tree);
  for (const value of [' km', 'Audio', 'QR:', 'Core Zone', 'Most Visited', 'Nearest Distance', 'Fake era', 'fake-qr']) assert.equal(content.includes(value), false, value);
  assert.equal(find(tree, node => node.props?.id === 'explore-sort-select'), undefined);
  assert.ok(find(tree, node => node.props?.id === 'view-details-1'));
  assert.equal(find(tree, node => node.type === 'span' && node.props?.children === 'Live site'), undefined);
});

test('map markers escape HTML characters and filtering clears selection without choosing another site', async () => {
  const first = { ...await mappedSite(), name: "<img/onerror=alert(1)> &\"'", category: 'Churches' };
  const second = { ...first, id: '2', name: 'Real Museum', category: 'Museums' };
  const icons = [], markers = [];
  const map = { remove() {}, removeLayer() {}, addLayer() {}, setView() {}, panTo() {} };
  const layer = () => ({ addTo() { return this; }, remove() {}, on() { return this; } });
  const leaflet = { map: () => map, tileLayer: layer, polygon: layer, polyline: layer,
    divIcon: value => { icons.push(value.html); return value; }, marker: (position, options) => { markers.push(options.title); return layer(); } };
  const props = { sites: [first, second, { ...first, id: '3', coordinates: null }], initialViewMode: 'map', selectedCategory: 'All', savedSiteIds: [] };
  const view = harness('../src/views/MapView.tsx', 'MapView', props, { leaflet, 'motion/react': motionModule });
  view.render(); view.flush();
  const html = icons.find(value => value.includes('&lt;img'));
  assert.ok(html.includes('&lt;img/onerror=alert(1)&gt;')); assert.ok(html.includes('&amp;&quot;&#39;')); assert.equal(html.includes('<img/onerror'), false);
  assert.equal(markers.length, 2);
  markers.length = 0;
  view.render({ ...props, selectedCategory: 'Museums' }); view.flush();
  assert.equal(find(view.render(), node => node.props?.id === 'map-floating-site-card'), undefined);
  assert.deepEqual(markers, ['Real Museum']);
});

test('saved places start empty, reject legacy IDs, hide stale DB IDs and save/unsave deep-linked sites', async () => {
  const site = await mappedSite(); const browser = browserAt('#/heritage/1'); const view = appFor(browser, async () => site, [site]);
  view.render(); view.flush(); await tick();
  let detail = detailNode(view.render()); assert.equal(detail.props.isSaved, false);
  detail.props.onToggleSave('1'); view.render(); view.flush();
  assert.equal(detailNode(view.render()).props.isSaved, true); assert.equal(localStorage.getItem('sf_saved_sites'), '["1"]');
  detailNode(view.render()).props.onToggleSave('1'); view.render(); view.flush(); assert.equal(localStorage.getItem('sf_saved_sites'), '[]');
  localStorage.setItem('sf_saved_sites', JSON.stringify(['metropolitan-cathedral', '1', '999']));
  const next = appFor(browserAt('#/saved'), async () => site, [site]); next.render(); next.flush(); await tick();
  const tree = next.render(); assert.deepEqual(Array.from(find(tree, node => node.type?.displayName === 'SavedView').props.savedSites, s => s.id), ['1']);
  assert.equal(find(tree, node => node.type?.displayName === 'Header').props.savedCount, 1);
  next.flush(); assert.equal(localStorage.getItem('sf_saved_sites'), '["1","999"]');
  assert.equal(find(tree, node => node.type?.displayName === 'QRScannerModal'), undefined);
  assert.equal(find(tree, node => node.type?.displayName === 'Header').props.onOpenQRScanner, undefined);
});

test('Search matches actual address/history instead of fabricated barangay and opens exact DB-ID URL', async () => {
  const site = { ...await mappedSite(), address: 'Actual Street', story: 'Recorded restoration', barangay: 'Imaginary village' };
  const browser = browserAt(); const app = appFor(browser, async () => site, [site]); app.render(); app.flush(); await tick();
  const callback = find(app.render(), node => node.type?.displayName === 'SearchModal').props.onSelectSite;
  let closed = false;
  const search = harness('../src/components/SearchModal.tsx', 'SearchModal', { isOpen: true, onClose() { closed = true; }, sites: [site], events: [], onSelectSite: callback });
  find(search.render(), node => node.type === 'input').props.onChange({ target: { value: 'Imaginary' } });
  assert.equal(find(search.render(), node => node.props?.id === 'search-site-1'), undefined);
  for (const query of ['Actual Street', 'restoration', 'Churches']) {
    find(search.render(), node => node.type === 'input').props.onChange({ target: { value: query } });
    assert.ok(find(search.render(), node => node.props?.id === 'search-site-1'));
  }
  find(search.render(), node => node.props?.id === 'search-site-1').props.onClick();
  assert.equal(closed, true); assert.equal(browser.location.hash, '#/heritage/1');
});

test('chatbot returns only recorded live history/timeline/visitor data and no legacy facts', async () => {
  const site = { ...await mappedSite(), id: '17', name: 'Current Train Station', yearBuilt: '', address: 'Saved address', fullDescription: 'Saved description', story: 'Saved history',
    timeline: [{ year: 'circa 2000', title: 'Saved timeline title', description: 'Saved timeline detail' }], visitInfo: { entranceFee: 'Saved admission' } };
  const result = chatEngine.getLocalHeritageResponse('History of the train station', [site]);
  assert.equal(result.matchedSiteId, '17');
  for (const value of ['Saved address', 'Saved description', 'Saved history', 'Saved timeline title', 'Saved admission']) assert.ok(result.text.includes(value));
  for (const value of ['1892', 'Jose Rizal', '102-kilometer', 'Free', 'Unknown', '8:30']) assert.equal(result.text.includes(value), false);
  const none = chatEngine.getLocalHeritageResponse('train station', []); assert.equal(none.matchedSiteId, undefined); assert.equal(none.text.includes('1892'), false);
  assert.equal(chatEngine.getLocalHeritageResponse('train station', [{ ...site, status: 'archived' }]).matchedSiteId, undefined);
  assert.equal(chatEngine.getLocalHeritageResponse('plan a walking route', [site]).text.includes('8:30'), false);
});

test('Plan preserves real saved places without disconnected legacy tours or estimated distance/duration', async () => {
  const site = await mappedSite(); let opened;
  const tree = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [site], savedSiteIds: ['1', 'cathedral', '999'], onSelectSite(value) { opened = value; } }, { 'motion/react': motionModule }).render();
  assert.ok(allText(tree).includes(site.name));
  for (const value of ['1.4 km', '3.5 Hours', '08:30', 'cathedral', 'generate your personalized tour route']) assert.equal(allText(tree).includes(value), false);
  find(tree, node => node.type === 'div' && node.props?.onClick).props.onClick(); assert.equal(opened.id, '1');
});


test('chatbot ignores old fabricated chat history and answers locally without an AI request', async () => {
  sessionStorage.setItem('sf_heritage_chat_history', JSON.stringify([{ id: 'old', role: 'assistant', content: 'Legacy fabricated narrative' }]));
  const site = { ...await mappedSite(), name: 'Current Station', story: 'Current recorded history' };
  let requests = 0; fetch = async () => { requests++; throw new Error('No AI calls'); };
  const view = harness('../src/components/HeritageChatbot.tsx', 'HeritageChatbot', { sites: [site], onSelectSite() {} }, { 'motion/react': motionModule });
  find(view.render(), node => node.props?.id === 'heritage-chatbot-trigger-btn').props.onClick();
  assert.equal(allText(view.render()).includes('Legacy fabricated narrative'), false);
  find(view.render(), node => node.props?.id === 'heritage-chat-input').props.onChange({ target: { value: 'Current Station' } });
  find(view.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();
  assert.equal(requests, 0); assert.ok(allText(view.render()).includes('Current recorded history'));
});

test('unknown category remains unknown instead of becoming a Cultural Site', async () => {
  fetch = async () => reply([{ id: 1, name: 'Recorded site', category: null, status: 'active' }]);
  const [site] = await api.apiFetchSites(); assert.equal(site.category, '');
  const response = chatEngine.getLocalHeritageResponse('unrelated question', [site]);
  assert.equal(response.matchedSiteId, undefined); assert.equal(response.text.includes('Cultural Sites'), false);
});


test('existing Events related-heritage cards still resolve current database IDs without prototype fields', async () => {
  const site = await mappedSite(); let opened;
  const event = { id: '8', title: 'Existing event', category: 'Festival', location: 'Saved event location', shortDescription: 'Event overview', fullDescription: 'Event details',
    date: 'October 7', dateBadge: 'OCT 7', time: '10 AM', bannerImage: '/images/event.jpg', schedule: [], relatedSiteIds: ['1'], tags: [] };
  const tree = harness('../src/views/EventsView.tsx', 'EventsView', { events: [event], sites: [site], selectedEvent: event, savedEventIds: [], onSelectSite(value) { opened = value; } }, { 'motion/react': motionModule }).render();
  assert.ok(allText(tree).includes(site.name));
  find(tree, node => node.type === 'div' && node.props?.onClick && allText(node).includes(site.name)).props.onClick();
  assert.equal(opened.id, '1');
  assert.ok(allText(tree).includes(site.address));
  const image = find(tree, node => node.type === 'img' && node.props.alt === site.name);
  assert.equal(image.props.src, site.heroImage);
  const element = { src: 'broken.jpg', getAttribute() { return this.src; } };
  image.props.onError({ currentTarget: element });
  assert.equal(element.src, imageHelpers.HERITAGE_IMAGE_PLACEHOLDER);
});
