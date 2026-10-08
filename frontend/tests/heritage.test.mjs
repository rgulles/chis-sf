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
const mapHelpers = await load('../src/utils/heritageMap.ts');
const customHelpers = await load('../src/utils/customItinerary.ts');
const cityHelpers = await load('../src/utils/cityBoundary.ts');
const cityGeoJSON = JSON.parse(read('../public/data/san-fernando-pampanga-boundary.geojson'));
const chatEngine = await load('../src/data/heritageChatEngine.ts');
const categories = ['All', 'Historical Buildings', 'Churches', 'Museums', 'Monuments', 'Cultural Sites'];
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const tick = () => new Promise(resolve => setImmediate(resolve));

function visibleText(tree) {
  if (Array.isArray(tree)) return tree.map(visibleText).join('');
  if (tree && typeof tree === 'object') return visibleText(tree.props?.children);
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
}

test('API safely distinguishes HTTP statuses, offline and malformed responses', async () => {
  for (const [status, pattern] of [[401, /session has expired/], [403, /permission/], [404, /not found/], [409, /unavailable/], [422, /check the information/], [429, /Too many/], [500, /temporarily unavailable/], [503, /temporarily unavailable/]]) {
    fetch = async () => reply({ message: 'SQLSTATE Exception C:\\secret.php' }, status);
    await assert.rejects(api.apiFetchEvents(), error => error.status === status && pattern.test(error.message) && !/SQLSTATE|Exception|secret/.test(error.message));
  }
  fetch = async () => { throw new Error('private connection details'); };
  await assert.rejects(api.apiFetchEvents(), error => error.code === 'network' && /Unable to connect to CHIS/.test(error.message));
  fetch = async () => new Response('<html>private stack trace</html>');
  await assert.rejects(api.apiFetchEvents(), error => error.code === 'malformed' && !error.message.includes('private'));
  fetch = async () => reply([]); assert.deepEqual(await api.apiFetchEvents(), []);
});

test('authenticated 401 clears matching session; stale 401 preserves newer login', async () => {
  const browser = new EventTarget(), previous = globalThis.window;
  globalThis.window = browser;
  let expired = 0; browser.addEventListener('chis:session-expired', () => expired++);
  try {
    localStorage.setItem('chis_jwt_token', 'old-token'); localStorage.setItem('sf_user_profile', '{}');
    fetch = async () => reply({}, 401);
    await assert.rejects(api.apiFetchPassport(), /session has expired/);
    assert.equal(api.getJwtToken(), null); assert.equal(localStorage.getItem('sf_user_profile'), null); assert.equal(expired, 1);
    localStorage.setItem('chis_jwt_token', 'old-token');
    fetch = async () => { localStorage.setItem('chis_jwt_token', 'new-token'); return reply({}, 401); };
    await assert.rejects(api.apiFetchPassport()); assert.equal(api.getJwtToken(), 'new-token'); assert.equal(expired, 1);
  } finally { globalThis.window = previous; }
});

test('reusable error states offer accessible messages and retries', () => {
  for (const kind of ['network', 'server', 'load', 'authentication', 'permission', 'not-found', 'validation']) {
    let retried = 0;
    const view = harness('../src/components/ErrorState.tsx', 'ErrorState', { kind, onRetry: () => retried++ });
    const tree = view.render(); view.flush();
    assert.equal(tree.props.role, 'alert'); assert.equal(tree.props.tabIndex, -1);
    find(tree, node => node.type === 'button').props.onClick(); assert.equal(retried, 1);
    assert.ok(visibleText(tree).length > 30);
  }
});

test('ErrorBoundary renders safe fallback and both recovery actions', () => {
  const exports = {}, browser = { location: { hash: '', reload() { browser.reloaded = true; } } };
  vm.runInNewContext(compile(read('../src/components/ErrorBoundary.tsx').replace('import.meta.env.DEV', 'false')), {
    exports, window: browser, console,
    require(name) {
      if (name === 'react') return require('react');
      if (name === 'react/jsx-runtime') return require(name);
      if (name === './ErrorState') return { ErrorState: props => harness('../src/components/ErrorState.tsx', 'ErrorState', props).render() };
      throw new Error(name);
    },
  });
  const boundary = new exports.ErrorBoundary({ children: 'Healthy CHIS' });
  assert.equal(visibleText(boundary.render()), 'Healthy CHIS');
  boundary.state = { ...boundary.state, ...exports.ErrorBoundary.getDerivedStateFromError(new Error('SQLSTATE private stack')) };
  boundary.componentDidCatch(new Error('private'), { componentStack: 'private' });
  const fallback = boundary.render().props.children;
  const tree = fallback.type(fallback.props), text = visibleText(tree);
  assert.ok(text.includes('Something went wrong') && text.includes("We couldn't load this part of CHIS."));
  assert.equal(/SQLSTATE|private|stack/.test(text), false);
  boundary.setState = update => { boundary.state = { ...boundary.state, ...(typeof update === 'function' ? update(boundary.state) : update) }; };
  find(tree, node => node.type === 'button' && visibleText(node) === 'Try Again').props.onClick();
  assert.equal(boundary.state.failed, false); assert.equal(boundary.state.revision, 1);
  find(tree, node => node.type === 'button' && visibleText(node) === 'Return Home').props.onClick();
  assert.equal(browser.location.hash, '#/home'); assert.equal(browser.reloaded, true);
});

test('old token and invalid routes show not found; Passport remains a visitor view', () => {
  assert.equal(navigation.parseHeritageRoute('#/check-in/' + 'a'.repeat(64)).view, 'not-found');
  assert.equal(navigation.parseHeritageRoute('#/bogus').view, 'not-found');
  assert.equal(navigation.parseHeritageRoute('#/passport').view, 'passport');
  assert.equal(read('../src/App.tsx').includes('setCheckinToken'), false);
});

test('check-in and passport API use authenticated verification with only transient fix fields', async () => {
  localStorage.setItem('chis_jwt_token', 'visitor-token');
  const requests = [], token = '1';
  fetch = async (url, options) => {
    requests.push({ url, ...options });
    if (url.endsWith('/verify-visit')) return reply({ status: 'verified', points_earned: 100, visit: { id: 3, heritage_site_id: 1, verified_at: '2026-10-08T12:00:00Z', points_awarded: 100 } }, 201);
    return reply({ enabled: true, coordinates_configured: true, site: rawSite });
  };
  assert.equal((await api.apiVerifyVisit(token, { latitude: 15, longitude: 120, accuracy: 10 })).points_earned, 100);
  assert.equal(requests[0].headers.Authorization, 'Bearer visitor-token');
  assert.deepEqual(JSON.parse(requests[0].body), { latitude: 15, longitude: 120, accuracy: 10 });
  fetch = async () => reply({ code: 'outside', message: "You're outside the verification area for this heritage site." }, 422);
  await assert.rejects(api.apiVerifyVisit(token, { latitude: 0, longitude: 0, accuracy: 5 }), /outside/);
  fetch = async () => reply({}, 401); await assert.rejects(api.apiFetchPassport(), /sign in/);
  fetch = async () => reply({}); await assert.rejects(api.apiFetchPassport(), /Invalid passport/);
});

const visitor = { id: '2', name: 'Real visitor', email: 'visitor@example.test', role: 'traveler' };
const checkinProps = { site: { id: '1', name: 'Heritage site' }, user: visitor, onLogin() {}, onPassport() {}, onSite() {}, onExplore() {}, onVerified() {} };
const checkinContext = async () => ({ enabled: true, coordinates_configured: true, site: await mappedSite() });

test('Site Detail offers enabled verification, hides disabled action, and guests sign in before locating', async () => {
  let login = 0, fixes = 0;
  const modules = { '../api/client': { apiCheckinAvailability: async () => true }, __navigator: { geolocation: { getCurrentPosition() { fixes++; } } } };
  const view = harness('../src/components/VisitVerification.tsx', 'VisitVerification', { ...checkinProps, user: null, onLogin: () => login++ }, modules);
  view.render(); view.flush(); await tick();
  const action = find(view.render(), node => node.props?.id === 'verify-location');
  assert.equal(allText(action), 'Verify My Visit'); assert.equal(fixes, 0);
  action.props.onClick(); assert.equal(login, 1); assert.equal(fixes, 0);
  const disabled = harness('../src/components/VisitVerification.tsx', 'VisitVerification', checkinProps, { '../api/client': { apiCheckinAvailability: async () => false } });
  disabled.render(); disabled.flush(); await tick(); assert.equal(disabled.render(), null);
});

test('check-in requests one high accuracy fix, locks duplicate clicks and handles permission denial', async () => {
  const context = await checkinContext(); let callback, options, calls = 0;
  const view = harness('../src/components/VisitVerification.tsx', 'VisitVerification', checkinProps, {
    '../api/client': { apiCheckinAvailability: async () => true }, __window: { isSecureContext: true },
    __navigator: { geolocation: { getCurrentPosition(_success, failure, settings) { calls++; callback = failure; options = settings; } } },
  });
  view.render(); view.flush(); await tick();
  const verify = find(view.render(), node => node.props?.id === 'verify-location'); verify.props.onClick(); verify.props.onClick();
  assert.equal(calls, 1); assert.ok(find(view.render(), node => node.props?.id === 'verify-location').props.disabled);
  assert.ok(allText(view.render()).includes('Getting your location'));
  assert.deepEqual({ ...options }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  callback({ code: 1 }); assert.ok(allText(view.render()).includes('permission denied'));
  assert.equal(find(view.render(), node => node.props?.id === 'verify-location').props.disabled, false);
  verify.props.onClick(); callback({ code: 2 }); assert.ok(allText(view.render()).includes('Location unavailable'));
  verify.props.onClick(); callback({ code: 3 }); assert.ok(allText(view.render()).includes('timed out'));
});

for (const state of ['outside', 'weak_accuracy', 'verified', 'already_visited']) {
  test(`check-in handles ${state} without showing precise location or fabricated rewards`, async () => {
    const context = await checkinContext(); let success, captured, refreshed = 0;
    const view = harness('../src/components/VisitVerification.tsx', 'VisitVerification', { ...checkinProps, onVerified: () => refreshed++ }, {
      '../api/client': { apiCheckinAvailability: async () => true, apiVerifyVisit: async (_token, fix) => {
        captured = fix;
        if (state === 'outside') throw new Error("You're outside the verification area for this heritage site.");
        if (state === 'weak_accuracy') throw new Error('GPS accuracy is weak or unavailable.');
        return { status: state, points_earned: state === 'verified' ? 100 : 0, visit: { verified_at: '2026-10-08T12:00:00Z', points_awarded: 100 } };
      } }, __window: { isSecureContext: true }, __navigator: { geolocation: { getCurrentPosition(callback) { success = callback; } } },
    });
    view.render(); view.flush(); await tick(); find(view.render(), node => node.props?.id === 'verify-location').props.onClick();
    await success({ coords: { latitude: 15.028391234, longitude: 120.693141234, accuracy: 10 } });
    assert.deepEqual({ ...captured }, { latitude: 15.028391234, longitude: 120.693141234, accuracy: 10 });
    const text = visibleText(view.render()); assert.equal(text.includes('15.028391234'), false); assert.equal(text.includes('120.693141234'), false);
    assert.equal(localStorage.getItem('visitor_location'), null);
    if (state === 'verified') { assert.ok(text.includes('Visit Verified') && text.includes('+100 Points') && text.includes('stamp unlocked')); assert.equal(refreshed, 1); }
    else if (state === 'already_visited') { assert.ok(text.includes('Already Visited') && text.includes('No additional points')); assert.equal(text.includes('+100 Points'), false); }
    else { assert.equal(refreshed, 0); assert.ok(text.includes(state === 'outside' ? 'outside' : 'accuracy is weak')); }
  });
}

test('late geolocation after leaving check-in is ignored and insecure contexts cannot verify', async () => {
  const context = await checkinContext(); let callback, verifies = 0;
  const modules = { '../api/client': { apiCheckinAvailability: async () => true, apiVerifyVisit: async () => verifies++ }, __window: { isSecureContext: true }, __navigator: { geolocation: { getCurrentPosition(success) { callback = success; } } } };
  const view = harness('../src/components/VisitVerification.tsx', 'VisitVerification', checkinProps, modules);
  view.render(); view.flush(); await tick(); find(view.render(), node => node.props?.id === 'verify-location').props.onClick(); view.unmount();
  await callback({ coords: { latitude: 15, longitude: 120, accuracy: 5 } }); assert.equal(verifies, 0);
  const insecure = harness('../src/components/VisitVerification.tsx', 'VisitVerification', checkinProps, { ...modules, __window: { isSecureContext: false } });
  insecure.render(); insecure.flush(); await tick(); find(insecure.render(), node => node.props?.id === 'verify-location').props.onClick(); assert.ok(allText(insecure.render()).includes('requires HTTPS'));
});

test('verification displays session expiration safely', async () => {
  let callback;
  const view = harness('../src/components/VisitVerification.tsx', 'VisitVerification', checkinProps, {
    '../api/client': { apiCheckinAvailability: async () => true, apiVerifyVisit: async () => { throw new api.ApiError('Your session has expired. Please sign in again.', 401); } },
    __window: { isSecureContext: true }, __navigator: { geolocation: { getCurrentPosition(success) { callback = success; } } },
  });
  view.render(); view.flush(); await tick(); find(view.render(), node => node.props?.id === 'verify-location').props.onClick(); await callback({ coords: { latitude: 15, longitude: 120, accuracy: 10 } });
  assert.ok(allText(view.render()).includes('sign in again'));
});

test('Passport uses real totals and separates historical stamps from currently eligible progress', async () => {
  const site = await mappedSite(), archived = { ...site, id: '2', name: 'Archived historical visit', status: 'archived' }, unvisited = { ...site, id: '3', name: 'Unvisited official site' };
  const passport = { total_points: 200, visited_count: 2, eligible_site_count: 2, visited_eligible_count: 1, visits: [{ id: 1, heritage_site_id: 1, site, verified_at: '2026-10-08', points_awarded: 100 }, { id: 2, heritage_site_id: 2, site: archived, verified_at: '2026-10-07', points_awarded: 100 }], eligible_sites: [site, unvisited] };
  let selected;
  const props = { user: visitor, passport, error: '', onLogin() {}, onRetry() {}, onSite: value => { selected = value; } };
  const view = harness('../src/views/PassportView.tsx', 'PassportView', props), tree = view.render(), text = visibleText(tree);
  assert.ok(text.includes('200 Points') && text.includes('2 verified sites') && text.includes('1 / 2') && text.includes('Not yet visited') && text.includes('Currently unavailable'));
  assert.equal(find(tree, node => node.type === 'progress').props.value, 1);
  find(tree, node => node.type === 'button' && allText(node) === 'View Site').props.onClick(); assert.equal(selected.id, '1');
  assert.equal(find(view.render({ ...props, user: null }), node => node.type === 'progress'), undefined);
  assert.ok(allText(view.render({ ...props, passport: null, error: 'API unavailable' })).includes('Retry Passport'));
});

test('itinerary passport labels are optional and do not change custom IDs or order', async () => {
  const site = await mappedSite(); localStorage.setItem('sf_custom_itinerary', '["1"]');
  const props = { sites: [site], savedSiteIds: [], onSelectSite() {}, onExploreClick() {} };
  const view = harness('../src/views/PlanView.tsx', 'PlanView', props, { '../api/client': { apiFetchItineraries: async () => [] } });
  find(view.render(), node => node.props?.id === 'plan-custom-tab').props.onClick();
  assert.equal(allText(view.render()).includes('Not yet visited'), false);
  assert.ok(allText(view.render({ ...props, visitedSiteIds: [] })).includes('Not yet visited'));
  assert.ok(allText(view.render({ ...props, visitedSiteIds: ['1'] })).includes('Visited'));
  assert.equal(localStorage.getItem('sf_custom_itinerary'), '["1"]');
});

test('Admin visit verification saves enable/radius and has no token controls', async () => {
  const config = { id: 1, heritage_site_id: 1, enabled: true, radius_meters: 100, verified_visitors: 2 };
  let saved;
  const modules = { '../api/client': { apiFetchCheckinConfigs: async () => [config], apiSaveCheckinConfig: async (id, enabled, radius) => { saved = [id, enabled, radius]; return { ...config, enabled, radius_meters: radius }; } } };
  const view = harness('../src/components/AdminCheckins.tsx', 'AdminCheckins', { sites: [rawSite] }, modules);
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.props?.id === 'checkin-admin-site').props.onChange({ target: { value: '1' } });
  find(view.render(), node => node.props?.id === 'checkin-radius').props.onChange({ target: { value: '75' } });
  find(view.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await tick();
  assert.deepEqual(saved, ['1', true, 75]);
  const text = allText(view.render()); assert.ok(text.includes('Visit Verification') && text.includes('2 verified visitors'));
  assert.equal(/QR|public_token|Rotate/.test(text), false);
});

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
    await assert.rejects(api.apiFetchSites(), /Unable to load|Unable to connect|temporarily unavailable|unexpected response/);
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
  const slots = [], effects = [], timers = [], classes = [];
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
    exports, console, Error, localStorage, sessionStorage, setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
    window: modules.__window || { scrollTo() {} }, navigator: modules.__navigator || {}, URL,
    require(name) {
      if (name === imageModuleUrl) return imageHelpers;
      if (name.endsWith('/data/heritageChatEngine')) return chatEngine;
      if (name.endsWith('/utils/heritageNavigation')) return navigation;
      if (name === 'react') return hooks;
      if (name.endsWith('/ErrorState')) return { ErrorState: props => harness('../src/components/ErrorState.tsx', 'ErrorState', props).render() };
      if (name === 'react/jsx-runtime') {
        const runtime = require(name);
        return { ...runtime, jsx: (type, props, key) => type?.name === 'ErrorState' ? type(props) : runtime.jsx(type, props, key), jsxs: (type, props, key) => type?.name === 'ErrorState' ? type(props) : runtime.jsxs(type, props, key) };
      }
      if (modules[name]) return modules[name];
      if (name.endsWith('/utils/heritageMap')) return mapHelpers;
      if (name.endsWith('/utils/customItinerary')) return customHelpers;
      if (name.endsWith('/api/client')) return api;
      if (name.endsWith('/utils/cityBoundary')) return { ...cityHelpers, loadCityBoundary: async () => null };
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
      walk(tree, node => { if (node.props?.ref && typeof node.props.ref === 'object') node.props.ref.current = { scrollIntoView() {}, focus() {}, classList: { toggle(name, value) { classes.push([name, value]); } } }; });
      return tree;
    },
    flush() { const callbacks = pending; pending = []; callbacks.forEach(callback => callback()); },
    runTimers() { timers.splice(0).forEach(callback => callback()); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
    classes,
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
    assert.ok(find(tree, node => node.props?.role === 'alert'));
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
  assert.equal(invalidChip, undefined);
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
  find(view.render(), node => node.type === 'button' && node.props.children === 'Try Again').props.onClick();
  view.render(); view.flush(); await tick();
  assert.equal(detailNode(view.render()).props.site.id, '1');
});

test('direct API keeps archived/404 unavailable and distinguishes network, server and malformed errors', async () => {
  fetch = async () => reply({}, 404); assert.equal(await api.apiFetchSiteById('1'), null);
  for (const request of [async () => reply({}, 500), async () => { throw new Error('offline'); },
    async () => reply({ id: 2, status: 'active' }), async () => reply({ id: 1, status: 'archived' })]) {
    fetch = request; await assert.rejects(api.apiFetchSiteById('1'), /Unable to load|Unable to connect|temporarily unavailable|unexpected response/);
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
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [site], savedSiteIds: ['1', 'cathedral', '999'], onSelectSite(value) { opened = value; } });
  find(view.render(), node => node.props?.id === 'plan-custom-tab').props.onClick();
  find(view.render(), node => node.type === 'button' && allText(node) === 'Add saved places').props.onClick();
  const tree = view.render();
  assert.ok(allText(tree).includes(site.name));
  for (const value of ['1.4 km', '3.5 Hours', '08:30', 'cathedral', 'generate your personalized tour route']) assert.equal(allText(tree).includes(value), false);
  find(tree, node => node.props?.id === 'itinerary-view-site-1').props.onClick(); assert.equal(opened.id, '1');
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


test('map category icons cover the centralized categories with safe selected labels', () => {
  assert.deepEqual(Object.keys(mapHelpers.HERITAGE_MARKER_STYLES).sort(), categories.filter(c => c !== 'All').sort());
  const icons = { Churches: 'church', 'Historical Buildings': 'building', Museums: 'museum', Monuments: 'monument', 'Cultural Sites': 'heritage-star' };
  for (const [category, icon] of Object.entries(icons)) {
    const style = mapHelpers.heritageMarkerStyle(category);
    assert.equal(style.icon, icon); assert.match(style.color, /^#[0-9a-f]{6}$/); assert.ok(style.paths.length);
    for (const selected of [true, false]) {
      const html = mapHelpers.heritageMarkerHtml({ category, name: '<script> &danger' }, selected);
      assert.ok(html.includes('data-selected="' + selected + '"')); assert.ok(html.includes(style.color));
      assert.ok(html.includes('&lt;script&gt; &amp;danger')); assert.equal(html.includes('<script>'), false);
    }
  }
  assert.equal(mapHelpers.heritageMarkerStyle('').icon, 'pin');
  assert.equal(mapHelpers.heritageMarkerStyle('__proto__').icon, 'pin');
});

function mapRuntime() {
  const markers = [], polygons = [], tiles = [], options = [], fits = [], maxBounds = [], minZooms = [];
  const map = { remove() { this.removed = true; }, removeLayer(layer) { layer.removed = true; }, addLayer(layer) { layer.removed = false; }, setView() {}, panTo() {}, zoomIn() {}, zoomOut() {}, invalidateSize() {}, getBoundsZoom() { return 12; }, setMinZoom(zoom) { minZooms.push(zoom); }, fitBounds(bounds, config) { fits.push({ bounds, config }); }, setMaxBounds(bounds) { maxBounds.push(bounds); } };
  map.zoom = 12; map.events = {};
  map.getZoom = () => map.zoom;
  map.on = (event, callback) => { map.events[event] = callback; };
  map.off = event => { delete map.events[event]; };
  const layer = () => ({ addTo() { return this; }, remove() { this.removed = true; }, on(event, callback) { this[event] = callback; return this; } });
  return { markers, polygons, tiles, options, fits, maxBounds, minZooms, map, leaflet: {
    point: (x, y) => ({ x, y }),
    map: (container, config) => { options.push(config); return map; },
    tileLayer: (url, config) => { tiles.push({ url, config }); return layer(); },
    polygon: (points, config) => { const polygon = { ...layer(), points, config }; polygons.push(polygon); return polygon; },
    divIcon: value => value,
    marker: (position, config) => {
      const element = { attributes: {}, events: {}, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, callback) { this.events[name] = callback; } };
      const marker = { ...layer(), position, config, element, getElement: () => element, setZIndexOffset(offset) { this.config.zIndexOffset = offset; } };
      markers.push(marker); return marker;
    }
  } };
}

test('marker switching, dismissal, live card actions and shared list/map filters', async () => {
  const first = { ...await mappedSite(), name: 'Recorded Church', coordinates: { lat: 15.03, lng: 120.68 }, heroImage: '/saved-cover.jpg', yearBuilt: 'circa 1900', address: 'Actual address', shortDescription: 'Not needed in compact card', distanceKm: 99, audioStory: {}, qrCodeId: 'fake', scanCount: 999 };
  const second = { ...first, id: '2', name: 'Recorded Museum', category: 'Museums', coordinates: { lat: 15.04, lng: 120.69 } };
  const runtime = mapRuntime(); let opened, saved;
  const props = { sites: [first, second], initialViewMode: 'map', savedSiteIds: [], onSelectSite(site) { opened = site; }, onToggleSaveSite(id) { saved = id; } };
  const view = harness('../src/views/MapView.tsx', 'MapView', props, { leaflet: runtime.leaflet, 'motion/react': motionModule });
  view.render(); view.flush(); assert.equal(runtime.markers[0].config.zIndexOffset, 1000);
  runtime.markers[1].click(); let tree = view.render(); view.flush();
  let current = runtime.markers.filter(marker => !marker.removed);
  assert.equal(current.find(marker => marker.config.title === second.name).config.zIndexOffset, 1000);
  assert.ok(current.find(marker => marker.config.title === second.name).config.icon.html.includes('data-selected="true"'));
  assert.equal(current.find(marker => marker.config.title === first.name).config.zIndexOffset, 0);
  const card = find(tree, node => node.props?.id === 'map-floating-site-card');
  for (const text of [second.name, second.yearBuilt, second.address]) assert.ok(allText(card).includes(text));
  assert.equal(find(card, node => node.type === 'img').props.src, second.heroImage);
  for (const text of [' km', 'Audio', 'QR', '999', 'Not needed in compact card']) assert.equal(allText(card).includes(text), false);
  assert.equal(find(card, node => node.props?.id === 'map-card-directions-link').props.href, 'https://www.google.com/maps/dir/?api=1&destination=15.04,120.69');
  find(card, node => node.props?.id === 'map-floating-explore-btn').props.onClick(); assert.equal(opened, second);
  assert.ok(allText(card).includes('View Site'));
  find(card, node => node.props?.id === 'map-card-save-2').props.onClick(); assert.equal(saved, '2');
  const savedCard = find(view.render({ ...props, savedSiteIds: ['2'] }), node => node.props?.id === 'map-floating-site-card');
  assert.equal(find(savedCard, node => node.props?.id === 'map-card-save-2').props['aria-pressed'], true);
  assert.equal(find(savedCard, node => node.props?.id === 'map-card-save-2').props['aria-label'], 'Unsave site');
  view.render(props);
  find(card, node => node.props?.id === 'close-in-map-card-btn').props.onClick(); tree = view.render(); view.flush();
  assert.equal(find(tree, node => node.props?.id === 'map-floating-site-card'), undefined);
  assert.equal(find(tree, node => node.props?.id === 'quick-jump-2').props['aria-pressed'], true);
  runtime.markers.filter(marker => !marker.removed).find(marker => marker.config.title === second.name).click();
  assert.ok(find(view.render(), node => node.props?.id === 'map-floating-site-card'));
  find(view.render(), node => node.props?.id === 'toggle-map-filter-btn').props.onClick();
  find(view.render(), node => node.props?.id === 'map-filter-option-churches').props.onClick();
  tree = view.render(); view.flush(); tree = view.render();
  assert.equal(find(tree, node => node.props?.id === 'map-floating-site-card'), undefined);
  assert.deepEqual(runtime.markers.filter(marker => !marker.removed).map(marker => marker.config.title), [first.name]);
  find(tree, node => node.props?.id === 'toggle-list-view').props.onClick(); tree = view.render();
  assert.ok(find(tree, node => node.props?.id === 'view-details-1'));
  assert.equal(find(tree, node => node.props?.id === 'view-details-2'), undefined);
  assert.equal(find(tree, node => node.props?.id === 'filter-cat-churches').props['aria-pressed'], true);
  find(tree, node => node.props?.id === 'filter-cat-all').props.onClick(); tree = view.render();
  assert.ok(find(tree, node => node.props?.id === 'view-details-2'));
  find(tree, node => node.props?.id === 'toggle-map-view').props.onClick();
  assert.equal(find(view.render(), node => node.props?.id === 'map-floating-site-card'), undefined);
});

test('legend, empty states, mobile controls, real boundary and layer attribution', async () => {
  const runtime = mapRuntime(); const site = await mappedSite();
  const props = { sites: [site], initialViewMode: 'map', savedSiteIds: [] };
  const view = harness('../src/views/MapView.tsx', 'MapView', props, { leaflet: runtime.leaflet, 'motion/react': motionModule, '../utils/cityBoundary': { ...cityHelpers, loadCityBoundary: async () => cityHelpers.parseCityBoundary(cityGeoJSON) } });
  let tree = view.render(); view.flush(); await tick();
  for (const id of ['map-zoom-in-btn', 'map-zoom-out-btn', 'recenter-san-fernando-btn', 'toggle-map-filter-btn', 'toggle-layers-disclosure-btn', 'toggle-legend-disclosure-btn']) {
    const button = find(tree, node => node.props?.id === id); assert.ok(button); assert.ok(button.props['aria-label']); button.props.onClick();
  }
  tree = view.render();
  assert.equal(find(tree, node => node.props?.id === 'toggle-legend-disclosure-btn').props['aria-expanded'], true);
  for (const category of categories.filter(c => c !== 'All')) assert.ok(allText(tree).includes(category));
  assert.ok(allText(tree).includes('City of San Fernando, Pampanga boundary'));
  assert.equal(allText(tree).includes('approximate'), false);
  assert.equal(runtime.options[0].maxBoundsViscosity, 0.75); assert.equal(runtime.options[0].minZoom, 10);
  assert.equal(runtime.options[0].zoomSnap, 0.25); assert.equal(runtime.options[0].zoomDelta, 0.5);
  assert.ok(runtime.options[0].attributionControl);
  assert.equal(runtime.polygons.length, 2); assert.equal(runtime.polygons[0].config.fillRule, 'evenodd');
  assert.equal(runtime.polygons[0].config.interactive, false);
  assert.ok(runtime.tiles.at(-1).config.attribution.includes('https://www.openstreetmap.org/copyright'));
  tree = view.render({ ...props, selectedCategory: 'Museums' }); view.flush();
  assert.ok(allText(tree).includes('No heritage sites in this category'));
  assert.equal(runtime.markers.filter(marker => !marker.removed).length, 0);
  tree = view.render({ ...props, sites: [{ ...site, coordinates: null }] }); view.flush();
  assert.ok(allText(tree).includes('No mapped locations in this category'));
  assert.equal(find(tree, node => node.props?.id === 'map-card-directions-link'), undefined);
  find(tree, node => node.props?.id === 'toggle-layers-disclosure-btn').props.onClick(); tree = view.render();
  for (const label of ['OSM', 'Satellite']) {
    const button = find(tree, node => node.type === 'button' && allText(node) === label); assert.ok(button); button.props.onClick(); view.render(); view.flush();
  }
  assert.ok(runtime.tiles.at(-1).url.includes('World_Imagery')); assert.ok(runtime.tiles.at(-1).config.attribution.includes('Esri'));
});

test('local city geometry identifies Pampanga, includes Calulut, and derives bounds and mask', () => {
  const boundary = cityHelpers.parseCityBoundary(cityGeoJSON);
  assert.equal(cityGeoJSON.features.length, 1);
  const [[south, west], [north, east]] = boundary.bounds;
  assert.ok(south < 15.09509 && north > 15.09509 && west < 120.64853 && east > 120.64853);
  // Ray casting verifies the Calulut coordinate is inside the city, not just its box.
  const contains = ring => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [y, x] = ring[i], [previousY, previousX] = ring[j];
      if ((y > 15.09509) !== (previousY > 15.09509) && 120.64853 < (previousX - x) * (15.09509 - y) / (previousY - y) + x) inside = !inside;
    }
    return inside;
  };
  assert.ok(boundary.polygons.some(polygon => contains(polygon[0]) && !polygon.slice(1).some(contains)));
  assert.deepEqual(boundary.mask.slice(1), boundary.polygons.flat());
  assert.ok(boundary.navigationBounds[0][0] < south && boundary.navigationBounds[1][0] > north);
  const source = read('../src/views/MapView.tsx');
  for (const old of ['SAN_FERNANDO_BOUNDARY', 'SAN_FERNANDO_BOUNDS', 'approximate', 'Sapang Balen']) assert.equal(source.includes(old), false);
  assert.equal(source.includes('csfp_heritage_master'), false);
  assert.equal(read('../src/utils/cityBoundary.ts').includes('heritage_master'), false);
});

test('boundary parser handles MultiPolygon and interior holes and rejects unsafe assets', () => {
  const properties = cityGeoJSON.features[0].properties;
  const outer = [[120.65, 15.03], [120.70, 15.03], [120.70, 15.08], [120.65, 15.03]];
  const hole = [[120.67, 15.04], [120.68, 15.04], [120.68, 15.05], [120.67, 15.04]];
  const island = outer.map(([lng, lat]) => [lng + 0.05, lat]);
  const collection = { type: 'FeatureCollection', features: [{ properties, geometry: { type: 'MultiPolygon', coordinates: [[outer, hole], [island]] } }] };
  const boundary = cityHelpers.parseCityBoundary(collection);
  assert.equal(boundary.polygons.length, 2); assert.equal(boundary.mask.length, 4);
  assert.deepEqual(boundary.polygons[0][0][0], [15.03, 120.65]);
  assert.deepEqual(boundary.mask[2], hole.map(([lng, lat]) => [lat, lng]));
  for (const invalid of [null, {}, { ...collection, features: [] }, { ...collection, features: [...collection.features, ...collection.features] },
    { type: 'FeatureCollection', features: [{ properties: { ...properties, adm2_psgc: 103300000 }, geometry: collection.features[0].geometry }] },
    { type: 'FeatureCollection', features: [{ properties, geometry: { type: 'Point', coordinates: [120, 15] } }] },
    { type: 'FeatureCollection', features: [{ properties, geometry: { type: 'Polygon', coordinates: [[[120.6, 15], [120.7, 15], [NaN, 15], [120.6, 15]]] } }] },
    { type: 'FeatureCollection', features: [{ properties, geometry: { type: 'Polygon', coordinates: [[...outer.slice(0, -1), [120.69, 15.06]]] } }] },
  ]) assert.throws(() => cityHelpers.parseCityBoundary(invalid));
});

test('boundary loader uses only the local asset and safely handles unavailable or malformed data', async () => {
  let requested;
  fetch = async url => { requested = url; return reply(cityGeoJSON); };
  assert.deepEqual(await cityHelpers.loadCityBoundary(), cityHelpers.parseCityBoundary(cityGeoJSON));
  assert.equal(requested, '/data/san-fernando-pampanga-boundary.geojson');
  for (const request of [async () => reply({}, 404), async () => reply({}), async () => new Response('broken JSON'), async () => { throw new Error('offline'); }]) {
    fetch = request; assert.equal(await cityHelpers.loadCityBoundary(), null);
  }
});

test('real boundary fits initially and on recenter without resetting selection or category', async () => {
  const site = await mappedSite(), boundary = cityHelpers.parseCityBoundary(cityGeoJSON), runtime = mapRuntime();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [site], initialViewMode: 'map', savedSiteIds: [] }, {
    leaflet: runtime.leaflet, 'motion/react': motionModule, '../utils/cityBoundary': { ...cityHelpers, loadCityBoundary: async () => boundary },
  });
  view.render(); view.flush(); await tick();
  assert.deepEqual(runtime.fits[0].bounds, boundary.bounds);
  assert.deepEqual(runtime.maxBounds[0], boundary.navigationBounds);
  assert.equal(runtime.minZooms[0], 12);
  assert.equal(runtime.polygons[1].config.fill, false); assert.equal(runtime.polygons[1].config.interactive, false);
  assert.deepEqual(runtime.polygons[0].points, boundary.mask);
  const fits = runtime.fits.length;
  view.render(); view.flush(); assert.equal(runtime.fits.length, fits);
  find(view.render(), node => node.props?.id === 'recenter-san-fernando-btn').props.onClick();
  assert.deepEqual(runtime.fits.at(-1).bounds, boundary.bounds);
  assert.ok(find(view.render(), node => node.props?.id === 'map-floating-site-card'));
});

test('hidden map fits the loaded boundary when revealed and late loading ignores unmounted maps', async () => {
  let finish; const runtime = mapRuntime(); const site = await mappedSite();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [site], savedSiteIds: [] }, {
    leaflet: runtime.leaflet, 'motion/react': motionModule, '../utils/cityBoundary': { ...cityHelpers, loadCityBoundary: () => new Promise(resolve => { finish = resolve; }) },
  });
  view.render(); view.flush(); finish(cityHelpers.parseCityBoundary(cityGeoJSON)); await tick();
  assert.equal(runtime.fits.length, 0);
  find(view.render(), node => node.props?.id === 'toggle-map-view').props.onClick(); view.render(); view.flush(); view.runTimers();
  assert.deepEqual(runtime.fits[0].bounds, cityHelpers.parseCityBoundary(cityGeoJSON).bounds);
  view.unmount(); assert.equal(runtime.map.removed, true);
  const late = mapRuntime(); let complete;
  const pending = harness('../src/views/MapView.tsx', 'MapView', { sites: [site], savedSiteIds: [], initialViewMode: 'map' }, {
    leaflet: late.leaflet, 'motion/react': motionModule, '../utils/cityBoundary': { ...cityHelpers, loadCityBoundary: () => new Promise(resolve => { complete = resolve; }) },
  });
  pending.render(); pending.flush(); pending.unmount(); complete(cityHelpers.parseCityBoundary(cityGeoJSON)); await tick();
  assert.equal(late.polygons.length, 0); assert.equal(late.fits.length, 0);
});

test('boundary loading respects an overlay disabled before arrival and can toggle afterward', async () => {
  let finish; const runtime = mapRuntime();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [await mappedSite()], initialViewMode: 'map', savedSiteIds: [] }, {
    leaflet: runtime.leaflet, 'motion/react': motionModule, '../utils/cityBoundary': { ...cityHelpers, loadCityBoundary: () => new Promise(resolve => { finish = resolve; }) },
  });
  view.render(); view.flush();
  find(view.render(), node => node.props?.id === 'toggle-layers-disclosure-btn').props.onClick();
  const toggle = () => find(view.render(), node => node.type === 'input' && node.props.type === 'checkbox');
  toggle().props.onChange({ target: { checked: false } }); view.render(); view.flush();
  finish(cityHelpers.parseCityBoundary(cityGeoJSON)); await tick();
  assert.equal(runtime.polygons.length, 2);
  toggle().props.onChange({ target: { checked: true } }); view.render(); view.flush();
  toggle().props.onChange({ target: { checked: false } }); view.render(); view.flush();
  assert.equal(runtime.polygons.every(layer => layer.removed), true);
});

test('boundary failure preserves dynamic active markers and safe fallback recenter', async () => {
  const site = await mappedSite(), runtime = mapRuntime();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [site, { ...site, id: '2', status: 'archived' }, { ...site, id: '3', coordinates: null }, { ...site, id: '4', coordinates: { lat: NaN, lng: 120 } }], initialViewMode: 'map', savedSiteIds: [] }, { leaflet: runtime.leaflet, 'motion/react': motionModule });
  view.render(); view.flush(); await tick(); view.runTimers();
  assert.equal(runtime.markers.length, 1); assert.equal(runtime.polygons.length, 0);
  assert.deepEqual(runtime.fits[0].bounds, cityHelpers.FALLBACK_CITY_BOUNDS);
  assert.ok(find(view.render(), node => node.props?.id === 'map-floating-site-card'));
});

test('imported coordinate examples render through the API mapper without static runtime heritage content', async () => {
  // Backend source is a test fixture only; no visitor bundle imports this file.
  const master = JSON.parse(read('../../backend/database/data/csfp_heritage_master.json'));
  const rows = master.sites.filter(site => !site.review_required).map((site, index) => ({
    id: index + 100, name: site.name, category: site.category, status: 'active',
    latitude: site.coordinates?.verified ? site.coordinates.latitude : null,
    longitude: site.coordinates?.verified ? site.coordinates.longitude : null,
  }));
  fetch = async () => reply(rows);
  const sites = await api.apiFetchSites(), runtime = mapRuntime();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites, initialViewMode: 'map', savedSiteIds: [] }, { leaflet: runtime.leaflet, 'motion/react': motionModule });
  view.render(); view.flush();
  const valid = sites.filter(site => coordinates.hasUsableCoordinates(site.coordinates));
  assert.equal(sites.length, 34); assert.equal(valid.length, 21);
  assert.deepEqual(runtime.markers.map(marker => marker.config.title).sort(), valid.map(site => site.name).sort());
  for (const marker of runtime.markers) {
    const site = valid.find(site => site.name === marker.config.title);
    assert.deepEqual(Array.from(marker.position), [site.coordinates.lat, site.coordinates.lng]);
  }
});

test('map labels are icons only by default, with compact selected, hover and focus labels at close zoom', async () => {
  const site = { ...await mappedSite(), name: 'A full recorded heritage name <safe>' }, runtime = mapRuntime();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [site, { ...site, id: '2' }], initialViewMode: 'map', savedSiteIds: [] }, { leaflet: runtime.leaflet, 'motion/react': motionModule });
  view.render(); view.flush();
  assert.deepEqual(Array.from(view.classes[0]), ['heritage-map-close-zoom', false]);
  const count = runtime.markers.length;
  runtime.map.zoom = 15; runtime.map.events.zoomend();
  assert.deepEqual(Array.from(view.classes.at(-1)), ['heritage-map-close-zoom', true]);
  assert.equal(runtime.markers.length, count, 'zoom presentation does not recreate markers');
  runtime.map.zoom = 14; runtime.map.events.zoomend();
  assert.equal(view.classes.at(-1)[1], false);
  const selected = runtime.markers[0], unselected = runtime.markers[1];
  assert.ok(selected.config.icon.html.includes('width:38px;height:38px'));
  assert.ok(unselected.config.icon.html.includes('width:28px;height:28px'));
  assert.ok(selected.config.icon.html.includes('A full recorded heritage name &lt;safe&gt;'));
  for (const marker of runtime.markers) {
    assert.equal(marker.config.title, site.name);
    assert.equal(marker.element.attributes['aria-label'], site.name + ', Churches');
    assert.equal(marker.config.keyboard, true); assert.equal(marker.config.riseOnHover, true);
    assert.deepEqual(Array.from(marker.position), [site.coordinates.lat, site.coordinates.lng]);
    assert.deepEqual(Array.from(marker.config.icon.iconAnchor), [20, 20]);
  }
  unselected.element.events.focus(); assert.equal(unselected.config.zIndexOffset, 600);
  unselected.element.events.blur(); assert.equal(unselected.config.zIndexOffset, 0);
  selected.element.events.focus(); selected.element.events.blur(); assert.equal(selected.config.zIndexOffset, 1000);
  const css = read('../src/views/heritageMap.css');
  assert.match(css, /\.heritage-marker-label\s*\{\s*display: none;/);
  assert.ok(css.includes('.heritage-map-close-zoom .heritage-marker[data-selected="true"]'));
  assert.ok(css.includes('.heritage-custom-marker:focus-visible .heritage-marker-label'));
  assert.ok(css.includes('@media (hover: hover) and (pointer: fine)'));
  assert.ok(css.includes('pointer-events: none'));
  view.unmount(); assert.equal(runtime.map.events.zoomend, undefined);
});

function itineraryRow(stops = [rawSite, { ...rawSite, id: 2, name: 'Second recorded site', latitude: null, longitude: null }]) {
  return { id: 7, name: 'Live recommended route', description: 'Recorded route overview', status: 'active', stops: stops.map((site, index) => ({ id: index + 30, heritage_site_id: site.id, sort_order: index, heritage_site: site })) };
}

test('itinerary API maps ordered current site relationships and hides archived public content', async () => {
  const route = itineraryRow([{ ...rawSite, id: 5, name: 'Backend first' }, { ...rawSite, id: 1, name: 'Backend second' }]);
  fetch = async () => reply([route, { ...route, id: 8, status: 'archived' }]);
  const [mapped] = await api.apiFetchItineraries();
  assert.deepEqual(mapped.stops.map(stop => stop.site.id), ['5', '1']); assert.equal(mapped.id, '7');
  fetch = async () => reply({ ...route, stops: [...route.stops, { id: 39, heritage_site_id: 9, sort_order: 3, heritage_site: { ...rawSite, id: 9, status: 'archived' } }] });
  assert.equal((await api.apiFetchItineraryById('7')).stops.length, 2);
  fetch = async () => reply({}, 404); assert.equal(await api.apiFetchItineraryById('7'), null);
  for (const response of [() => reply({}, 500), () => reply({}), () => reply([{ ...route, stops: [{ ...route.stops[0], heritage_site_id: 99 }] }]), () => { throw new Error('offline'); }]) {
    fetch = async () => response(); await assert.rejects(api.apiFetchItineraries(), /Unable to load|Unable to connect|temporarily unavailable|unexpected response/);
  }
});

test('Recommended Plan loads API cards and detail in backend order with safe actions and map data', async () => {
  const requests = [], route = itineraryRow([{ ...rawSite, id: 2, name: 'First in route' }, { ...rawSite, id: 1, name: 'Second in route', latitude: null, longitude: null }]);
  fetch = async url => { requests.push(url); return reply(url.endsWith('/7') ? route : [route]); };
  let opened;
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [], savedSiteIds: [], onSelectSite(site) { opened = site; } });
  view.render(); view.flush(); await tick();
  assert.ok(allText(view.render()).includes('Live recommended route'));
  find(view.render(), node => node.props?.id === 'open-itinerary-7').props.onClick(); view.render(); view.flush(); await tick();
  const tree = view.render(), content = allText(tree);
  assert.ok(content.indexOf('First in route') < content.indexOf('Second in route'));
  assert.ok(content.includes('Stop 1') && content.includes('Stop 2'));
  assert.equal(find(tree, node => node.props?.id === 'itinerary-directions-1'), undefined);
  assert.equal(find(tree, node => node.props?.id === 'itinerary-directions-2').props.href, 'https://www.google.com/maps/dir/?api=1&destination=15,120');
  find(tree, node => node.props?.id === 'itinerary-view-site-2').props.onClick(); assert.equal(opened.id, '2');
  find(tree, node => node.props?.id === 'itinerary-map-toggle').props.onClick();
  const map = find(view.render(), node => node.type?.displayName === 'MapView');
  assert.deepEqual(map.props.sites.map(site => site.id), ['2', '1']);
  assert.ok(allText(view.render()).includes('1 stop has no verified map location'));
  for (const fake of [' km', 'Hours', 'difficulty', 'popularity']) assert.equal(content.includes(fake), false);
  assert.deepEqual(requests, ['/api/itineraries', '/api/itineraries/7']);
});

test('Recommended load errors and archived detail have clear retry/unavailable states', async () => {
  fetch = async () => reply({}, 500);
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [], savedSiteIds: [] });
  view.render(); view.flush(); await tick(); assert.ok(find(view.render(), node => node.props?.role === 'alert'));
  fetch = async () => reply([itineraryRow()]);
  find(view.render(), node => node.type === 'button' && allText(node) === 'Retry').props.onClick(); view.render(); view.flush(); await tick();
  fetch = async () => reply({}, 404);
  find(view.render(), node => node.props?.id === 'open-itinerary-7').props.onClick(); view.render(); view.flush(); await tick();
  assert.ok(allText(view.render()).includes('no longer available'));
});

test('custom itinerary persists only unique live IDs, manually reorders and restores after refresh', async () => {
  const first = await mappedSite(), second = { ...first, id: '2', name: 'Second', coordinates: null };
  fetch = async () => reply([]);
  const props = { sites: [first, second], savedSiteIds: [], onSelectSite() {} };
  const view = harness('../src/views/PlanView.tsx', 'PlanView', props);
  find(view.render(), node => node.props?.id === 'plan-custom-tab').props.onClick();
  for (const id of ['1', '2']) find(view.render(), node => node.props?.id === 'custom-add-' + id).props.onClick();
  let tree = view.render(); assert.equal(find(tree, node => node.props?.id === 'custom-add-1').props.disabled, true);
  find(tree, node => node.props?.id === 'custom-add-1').props.onClick();
  assert.equal(localStorage.getItem('sf_custom_itinerary'), '["1","2"]');
  find(view.render(), node => node.props?.id === 'custom-up-2').props.onClick();
  assert.equal(localStorage.getItem('sf_custom_itinerary'), '["2","1"]');
  const fresh = harness('../src/views/PlanView.tsx', 'PlanView', props);
  find(fresh.render(), node => node.props?.id === 'plan-custom-tab').props.onClick();
  tree = fresh.render(); assert.ok(allText(tree).indexOf('Second') < allText(tree).indexOf(first.name));
  assert.equal(find(tree, node => node.props?.id === 'itinerary-directions-2'), undefined);
  find(tree, node => node.props?.id === 'custom-down-2').props.onClick();
  assert.equal(localStorage.getItem('sf_custom_itinerary'), '["1","2"]');
  find(fresh.render(), node => node.props?.id === 'custom-remove-1').props.onClick(); assert.equal(localStorage.getItem('sf_custom_itinerary'), '["2"]');
  find(fresh.render(), node => node.props?.id === 'custom-clear').props.onClick(); assert.equal(localStorage.getItem('sf_custom_itinerary'), '[]');
});

test('custom itinerary discards stale/archived/prototype IDs only after successful catalogue loading', async () => {
  const first = await mappedSite(); fetch = async () => reply([]);
  localStorage.setItem('sf_custom_itinerary', '["999","1","2","1","cathedral",3]');
  const props = { sites: [], savedSiteIds: [], catalogueReady: false };
  const view = harness('../src/views/PlanView.tsx', 'PlanView', props);
  view.render(); view.flush(); await tick(); assert.equal(localStorage.getItem('sf_custom_itinerary'), '["999","1","2","1","cathedral",3]');
  view.render({ ...props, catalogueError: 'API unavailable' }); view.flush(); assert.equal(localStorage.getItem('sf_custom_itinerary'), '["999","1","2","1","cathedral",3]');
  view.render({ ...props, sites: [first, { ...first, id: '2', status: 'archived' }], catalogueReady: true }); view.flush();
  assert.equal(localStorage.getItem('sf_custom_itinerary'), '["1"]');
  find(view.render(), node => node.props?.id === 'plan-custom-tab').props.onClick();
  find(view.render(), node => node.props?.id === 'itinerary-map-toggle').props.onClick();
  assert.deepEqual(Array.from(find(view.render(), node => node.type?.displayName === 'MapView').props.sites, site => site.id), ['1']);
  for (const invalid of ['broken', '{}', '[null,{},"old-id"]']) { localStorage.setItem('sf_custom_itinerary', invalid); assert.deepEqual(customHelpers.readCustomItinerary(), []); }
});

test('custom search, coordinate-free stops, deep links, map filtering and storage failures remain truthful', async () => {
  const site = { ...await mappedSite(), coordinates: null, address: 'Saved street' }, browser = browserAt('#/plan');
  const app = appFor(browser, async () => site, [site]); app.render(); app.flush(); await tick();
  const select = find(app.render(), node => node.type?.displayName === 'PlanView').props.onSelectSite;
  fetch = async () => reply([]);
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [site], savedSiteIds: [], onSelectSite: select });
  find(view.render(), node => node.props?.id === 'plan-custom-tab').props.onClick();
  find(view.render(), node => node.props?.id === 'custom-site-search').props.onChange({ target: { value: 'missing' } });
  assert.equal(find(view.render(), node => node.props?.id === 'custom-add-1'), undefined);
  find(view.render(), node => node.props?.id === 'custom-site-search').props.onChange({ target: { value: 'Saved street' } });
  const original = localStorage.setItem; localStorage.setItem = () => { throw new Error('blocked'); };
  find(view.render(), node => node.props?.id === 'custom-add-1').props.onClick();
  assert.ok(allText(view.render()).includes('could not save'));
  localStorage.setItem = original;
  find(view.render(), node => node.props?.id === 'itinerary-map-toggle').props.onClick();
  const mapSites = find(view.render(), node => node.type?.displayName === 'MapView').props.sites;
  const runtime = mapRuntime(), map = harness('../src/views/MapView.tsx', 'MapView', { sites: mapSites, initialViewMode: 'map', savedSiteIds: [] }, { leaflet: runtime.leaflet, 'motion/react': motionModule });
  map.render(); map.flush(); assert.equal(runtime.markers.length, 0);
  find(view.render(), node => node.props?.id === 'itinerary-view-site-1').props.onClick(); assert.equal(browser.location.hash, '#/heritage/1');
});

test('Admin itinerary form submits ordered IDs, locks double submit, preserves validation failures and archives/restores', async () => {
  localStorage.setItem('chis_jwt_token', 'admin-token');
  const route = itineraryRow(), requests = []; let resolveSave;
  fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    if (!options.method || options.method === 'GET') return reply([route]);
    if (options.method === 'POST') return new Promise(resolve => { resolveSave = resolve; });
    return reply(route);
  };
  const props = { sites: [{ id: 1, name: 'Live', status: 'active' }, { id: 2, name: 'Second', status: 'active' }, { id: 3, name: 'Archived', status: 'archived' }] };
  const view = harness('../src/components/AdminItineraries.tsx', 'AdminItineraries', props);
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.props?.id === 'admin-itinerary-new').props.onClick();
  find(view.render(), node => node.props?.id === 'admin-itinerary-name').props.onChange({ target: { value: 'Admin route' } });
  for (const id of ['1', '2']) find(view.render(), node => node.props?.id === 'admin-itinerary-add-stop').props.onChange({ target: { value: id } });
  assert.equal(find(view.render(), node => node.type === 'option' && node.props.value === '3'), undefined);
  find(view.render(), node => node.props?.id === 'admin-itinerary-up-2').props.onClick();
  const form = find(view.render(), node => node.props?.id === 'admin-itinerary-form');
  form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} });
  assert.equal(requests.filter(request => request.method === 'POST').length, 1);
  const payload = JSON.parse(requests.at(-1).body); assert.deepEqual(payload.stops, [{ heritage_site_id: 2, sort_order: 0 }, { heritage_site_id: 1, sort_order: 1 }]);
  assert.equal(requests.at(-1).headers.Authorization, 'Bearer admin-token');
  resolveSave(reply({ message: 'Invalid', errors: { name: ['Name rejected'] } }, 422)); await tick();
  assert.ok(allText(view.render()).includes('Name rejected')); assert.ok(find(view.render(), node => node.props?.id === 'admin-itinerary-form'));
  form.props.onSubmit({ preventDefault() {} }); resolveSave(reply(route, 201)); await tick(); view.render(); view.flush(); await tick();
  assert.equal(find(view.render(), node => node.props?.id === 'admin-itinerary-form'), undefined);
  find(view.render(), node => node.props?.id === 'admin-itinerary-status-7').props.onClick(); await tick();
  assert.ok(requests.some(request => request.url === '/api/itineraries/7' && request.method === 'DELETE'));
  view.render(); view.flush(); await tick();
  fetch = async (url, options = {}) => { requests.push({ url, ...options }); return reply(options.method && options.method !== 'GET' ? route : [{ ...route, status: 'archived' }]); };
  const archived = harness('../src/components/AdminItineraries.tsx', 'AdminItineraries', props); archived.render(); archived.flush(); await tick();
  find(archived.render(), node => node.props?.id === 'admin-itinerary-status-7').props.onClick(); await tick();
  assert.ok(requests.some(request => request.method === 'PATCH' && JSON.parse(request.body).status === 'active'));
});
