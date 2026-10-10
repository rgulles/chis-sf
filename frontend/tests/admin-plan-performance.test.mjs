import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeEach, test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const compile = (source, module = ts.ModuleKind.CommonJS) => ts.transpileModule(source, {
  compilerOptions: { module, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const load = source => import(`data:text/javascript;base64,${Buffer.from(compile(source, ts.ModuleKind.ESNext)).toString('base64')}`);
const imageSource = read('../src/utils/heritageImages.ts');
const imageUrl = `data:text/javascript;base64,${Buffer.from(compile(imageSource, ts.ModuleKind.ESNext)).toString('base64')}`;
const api = await load(read('../src/api/client.ts').replace("'../utils/heritageImages'", JSON.stringify(imageUrl)));
const images = await load(imageSource);
const adminData = await load(read('../src/utils/adminData.ts').replace("'./heritageImages'", JSON.stringify(imageUrl)));
const custom = await load(read('../src/utils/customItinerary.ts'));
const coordinates = await load(read('../src/utils/heritageCoordinates.ts'));
const coordinatesUrl = `data:text/javascript;base64,${Buffer.from(compile(read('../src/utils/heritageCoordinates.ts'), ts.ModuleKind.ESNext)).toString('base64')}`;
const osrm = await load(read('../src/utils/osrm.ts').replace("'./heritageCoordinates'", JSON.stringify(coordinatesUrl)));
const tick = () => new Promise(resolve => setImmediate(resolve));
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const rawSite = { id: 1, name: 'Landmark', address: 'Recorded address', status: 'active', category: 'Churches',
  description: 'Recorded overview', history: 'Recorded history', latitude: 15.03, longitude: 120.69,
  images: [{ id: 8, heritage_site_id: 1, image_path: 'heritage-sites/photo.jpg', caption: '', is_cover: true, sort_order: 0 }],
  timelines: [{ id: 9, heritage_site_id: 1, year: '1900', title: 'Recorded title', description: 'Recorded history', sort_order: 0 }] };
const rawRoute = { id: 7, name: 'Route', status: 'active', description: 'Recorded route', stops: [rawSite,
  { ...rawSite, id: 2, name: 'Second', latitude: 15.04, longitude: 120.70 }].map((site, index) => ({ id: index + 1, heritage_site_id: site.id, sort_order: index, heritage_site: { ...site, short_description: site.description, cover_image: site.images[0], images: undefined, timelines: undefined } })) };

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  api.setJwtToken('admin-token'); api.clearItineraryCache(); osrm.clearRoadRouteCache();
});

function harness(path, exportName, props, extra = {}) {
  const slots = [], effects = [], callbacks = [], toasts = [];
  let cursor = 0, confirmation;
  const hooks = {
    lazy: loader => Object.assign(() => null, { displayName: String(loader).match(/module\.(\w+)/)?.[1] }),
    Suspense: ({ children }) => children,
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(callback, deps) { const index = cursor++; if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { value: callback(), deps }; return slots[index].value; },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect(callback, deps) { const index = cursor++; if (!effects[index] || deps.some((value, i) => !Object.is(value, effects[index].deps[i]))) callbacks.push(() => { effects[index]?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; }); },
  };
  const exports = {};
  vm.runInNewContext(compile(read(path)), { exports, console, Error, Date, URL, localStorage, document: { body: {}, querySelectorAll: () => [], getElementById: () => null },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react-dom') return { createPortal: children => children };
      if (extra[name]) return extra[name];
      if (name.endsWith('/api/client')) return api;
      if (name.endsWith('/hooks/useToast')) return { useToast: () => ({ addToast: (...args) => toasts.push(args) }) };
      if (name.endsWith('/hooks/useConfirm')) return { useConfirm: () => ({ confirm: options => { confirmation = options; } }) };
      if (name.endsWith('/utils/heritageImages')) return images;
      if (name.endsWith('/utils/adminData')) return adminData;
      if (name.endsWith('/utils/customItinerary')) return custom;
      if (name.endsWith('/utils/heritageCoordinates')) return coordinates;
      if (name.endsWith('/utils/osrm')) return osrm;
      if (name.endsWith('/data/heritageCategories')) return { HERITAGE_CATEGORIES: ['Churches'] };
      return new Proxy({}, { get: (_, key) => Object.assign(() => null, { displayName: String(key) }) });
    },
  });
  return { render() { cursor = 0; return exports[exportName](props); }, flush() { callbacks.splice(0).forEach(callback => callback()); },
    async settle() { for (let i = 0; i < 3; i++) { this.render(); this.flush(); await tick(); } return this.render(); },
    get confirmation() { return confirmation; }, toasts };
}
function find(node, predicate) { if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean); if (!node || typeof node !== 'object') return; return predicate(node) ? node : find(node.props?.children, predicate); }
function text(node) { if (Array.isArray(node)) return node.map(text).join(''); return typeof node === 'string' || typeof node === 'number' ? String(node) : text(node?.props?.children ?? ''); }
const button = (tree, name) => find(tree, node => node.type === 'button' && (text(node).trim() === name || node.props.title === name || node.props.id === name));
const adminProps = { user: { id: '1', name: 'Admin', role: 'admin' }, onLogout() {} };

test('Admin GETs deduplicate, reuse short-lived data, expire and never cache failed responses', async () => {
  let count = 0;
  fetch = async () => { count++; return reply([rawSite]); };
  await Promise.all([api.apiFetchRawSites(), api.apiFetchRawSites()]); await api.apiFetchRawSites(); assert.equal(count, 1);
  const now = Date.now; Date.now = () => now() + 31000;
  try { await api.apiFetchRawSites(); assert.equal(count, 2); } finally { Date.now = now; }
  api.clearAdminReadCache(); fetch = async () => { count++; return reply({}, 500); };
  await assert.rejects(api.apiFetchRawSites()); await assert.rejects(api.apiFetchRawSites()); assert.equal(count, 4);
  fetch = async () => { count++; return reply([{}]); };
  await assert.rejects(api.apiFetchAdminItineraries()); await assert.rejects(api.apiFetchAdminItineraries()); assert.equal(count, 6);
});

test('Admin writes and token changes invalidate cached reads', async () => {
  const calls = [];
  fetch = async (url, options = {}) => { calls.push({ url, ...options }); return reply(options.method === 'PUT' ? rawSite : [rawSite]); };
  await api.apiFetchRawSites(); await api.apiUpdateSite('1', { name: 'Edited' }); await api.apiFetchRawSites();
  api.setJwtToken('another-admin'); await api.apiFetchRawSites();
  assert.equal(calls.filter(call => call.method === 'GET').length, 3);
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer another-admin');
});

test('Admin startup skips unused lists and tab revisits reuse the loaded section', async () => {
  const calls = []; fetch = async (url, options = {}) => { calls.push({ url, ...options }); return reply(url.endsWith('/heritage-sites') ? [rawSite] : []); };
  const view = harness('../src/views/AdminView.tsx', 'AdminView', adminProps);
  await view.settle(); assert.equal(calls.length, 0); // Lazy Dashboard owns its single summary request.
  button(view.render(), 'Heritage Sites').props.onClick(); await view.settle();
  assert.deepEqual(calls.map(call => call.url), ['/api/admin/heritage-sites']);
  button(view.render(), 'Events').props.onClick(); await view.settle();
  button(view.render(), 'Heritage Sites').props.onClick(); await view.settle();
  assert.equal(calls.length, 2); assert.ok(text(view.render()).includes('Landmark'));
});

test('basic site edit sends one PUT, skips unchanged children and updates without refetching', async () => {
  const calls = []; fetch = async (url, options = {}) => { calls.push({ url, ...options }); return reply(options.method === 'PUT' ? { ...rawSite, ...JSON.parse(options.body) } : [rawSite]); };
  const view = harness('../src/views/AdminView.tsx', 'AdminView', adminProps);
  await view.settle(); button(view.render(), 'Heritage Sites').props.onClick(); await view.settle();
  button(view.render(), 'Edit').props.onClick();
  find(view.render(), node => node.props?.placeholder === 'Site Name').props.onChange({ target: { value: 'Edited landmark' } });
  const form = find(view.render(), node => node.props?.id === 'admin-site-form');
  const pending = form.props.onSubmit({ preventDefault() {} }); await form.props.onSubmit({ preventDefault() {} }); await pending;
  assert.equal(calls.length, 2); assert.equal(calls[1].method, 'PUT'); assert.equal(calls[1].url, '/api/heritage-sites/1');
  assert.ok(text(view.render()).includes('Edited landmark')); assert.equal(find(view.render(), node => node.props?.id === 'admin-site-form'), undefined);
});

test('expired Admin section refresh retains loaded content while waiting', async () => {
  fetch = async url => reply(url.endsWith('/heritage-sites') ? [rawSite] : []);
  const view = harness('../src/views/AdminView.tsx', 'AdminView', adminProps);
  await view.settle(); button(view.render(), 'Heritage Sites').props.onClick(); await view.settle();
  button(view.render(), 'Events').props.onClick(); await view.settle();
  const now = Date.now; Date.now = () => now() + 31000;
  let complete;
  fetch = async () => new Promise(resolve => { complete = () => resolve(reply([{ ...rawSite, name: 'Fresh landmark' }])); });
  try {
    button(view.render(), 'Heritage Sites').props.onClick(); await view.settle();
    assert.ok(text(view.render()).includes('Landmark')); assert.ok(text(view.render()).includes('Refreshing this section'));
    complete(); await view.settle(); assert.ok(text(view.render()).includes('Fresh landmark'));
  } finally { Date.now = now; }
});

test('section load failure remains retryable without requesting unrelated lists', async () => {
  let fail = true, count = 0; fetch = async () => { count++; return reply(fail ? {} : [rawSite], fail ? 500 : 200); };
  const view = harness('../src/views/AdminView.tsx', 'AdminView', adminProps);
  await view.settle(); button(view.render(), 'Heritage Sites').props.onClick(); await view.settle();
  assert.ok(button(view.render(), 'Retry')); fail = false;
  await button(view.render(), 'Retry').props.onClick(); await view.settle();
  assert.equal(count, 2); assert.ok(text(view.render()).includes('Landmark'));
});

test('Plan switches modes/details without downloads and OSRM stays lazy and cached', async () => {
  const calls = [];
  fetch = async (url, options = {}) => { calls.push({ url, ...options }); return reply(url.includes('/route/v1/') ? { code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[120.69, 15.03], [120.70, 15.04]] }, distance: 1000, duration: 120 }] } : [rawRoute]); };
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [], savedSiteIds: [], onSelectSite() {}, onExploreClick() {} });
  await view.settle(); assert.equal(calls.length, 1);
  button(view.render(), 'Build My Own Itinerary').props.onClick(); await view.settle();
  button(view.render(), 'Recommended').props.onClick(); await view.settle();
  button(view.render(), 'open-itinerary-7').props.onClick();
  assert.ok(text(view.render()).includes('Recorded route')); await view.settle(); assert.equal(calls.length, 1);
  button(view.render(), 'itinerary-map-toggle').props.onClick(); await view.settle(); assert.equal(calls.length, 2);
  button(view.render(), 'itinerary-map-toggle').props.onClick(); await view.settle();
  button(view.render(), 'itinerary-map-toggle').props.onClick(); await view.settle(); assert.equal(calls.length, 2);
});

test('Plan list retry refreshes once and subsequent detail/back uses that refreshed list', async () => {
  let count = 0; fetch = async () => { count++; return reply(count === 1 ? {} : [rawRoute], count === 1 ? 500 : 200); };
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [], savedSiteIds: [], onSelectSite() {}, onExploreClick() {} });
  await view.settle(); button(view.render(), 'Retry').props.onClick(); await view.settle(); assert.equal(count, 2);
  button(view.render(), 'open-itinerary-7').props.onClick(); await view.settle();
  button(view.render(), 'Back to recommended itineraries').props.onClick(); await view.settle(); assert.equal(count, 2);
});

test('Admin itinerary save is locked, applies its response and does not reload the list', async () => {
  const calls = []; let complete;
  fetch = async (url, options = {}) => { calls.push({ url, ...options }); return options.method === 'POST' ? new Promise(resolve => { complete = () => resolve(reply(rawRoute)); }) : reply([rawRoute]); };
  const view = harness('../src/components/AdminItineraries.tsx', 'AdminItineraries', { sites: [{ id: 1, name: 'Landmark', status: 'active' }] });
  await view.settle(); button(view.render(), 'Create Itinerary').props.onClick();
  find(view.render(), node => node.type === 'input' && node.props.maxLength === 255).props.onChange({ target: { value: 'New route' } });
  find(view.render(), node => node.type === 'select' && node.props.value === '').props.onChange({ target: { value: '1' } });
  const form = find(view.render(), node => node.type === 'form');
  const pending = form.props.onSubmit({ preventDefault() {} }); await form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 2); complete(); await pending; await view.settle();
  assert.equal(calls.length, 2); assert.equal(find(view.render(), node => node.type === 'form'), undefined);
});
