import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test, { beforeEach } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const compile = (source, module = ts.ModuleKind.CommonJS) => ts.transpileModule(source, {
  compilerOptions: { module, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const imageUrl = `data:text/javascript;base64,${Buffer.from(compile(read('../src/utils/heritageImages.ts'), ts.ModuleKind.ESNext)).toString('base64')}`;
const api = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/api/client.ts').replace("'../utils/heritageImages'", JSON.stringify(imageUrl)), ts.ModuleKind.ESNext)).toString('base64')}`);
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const tick = () => new Promise(resolve => setImmediate(resolve));
beforeEach(() => {
  const values = new Map([['chis_jwt_token', 'admin-token']]);
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
});

function harness(initialSites) {
  let rows = initialSites, cursor = 0, confirmation;
  const slots = [], effects = [], callbacks = [], requests = [], toasts = [];
  let load = async () => rows;
  const hooks = {
    lazy: loader => Object.assign(() => null, { displayName: String(loader).match(/module\.(\w+)/)?.[1] }),
    Suspense: ({ children }) => children,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!effects[index] || deps.some((value, i) => !Object.is(value, effects[index][i]))) callbacks.push(() => { effects[index] = deps; callback(); });
    },
  };
  const exports = {};
  vm.runInNewContext(compile(read('../src/views/AdminView.tsx')), {
    exports, console, Error, URL, document: { querySelectorAll: () => [] },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../hooks/useConfirm') return { useConfirm: () => ({ confirm: options => { confirmation = options; } }) };
      if (name === '../hooks/useToast') return { useToast: () => ({ addToast: (...args) => toasts.push(args) }) };
      if (name === '../api/client') return { ...api, apiFetchRawSites: () => load(), apiFetchAdminEvents: async () => [], apiFetchSiteImages: async () => [] };
      if (name === '../utils/adminData') return { storageImageUrl: path => path };
      if (name === '../data/heritageCategories') return { HERITAGE_CATEGORIES: [] };
      return new Proxy({}, { get: (_, key) => Object.assign(() => null, { displayName: String(key) }) });
    },
  });
  fetch = async (url, options) => {
    requests.push({ url, ...options });
    const body = JSON.parse(options.body);
    if (options.method === 'DELETE') rows = body.permanent ? rows.filter(row => row.id !== 1) : rows.map(row => ({ ...row, status: 'archived' }));
    if (options.method === 'PUT') rows = rows.map(row => ({ ...row, status: body.status }));
    return reply({});
  };
  return {
    render() { cursor = 0; return exports.AdminView({ user: { id: '1', name: 'Admin' }, onLogout() {} }); },
    flush() { callbacks.splice(0).forEach(callback => callback()); },
    get confirmation() { return confirmation; }, requests, toasts,
    failRefresh() { load = async () => { throw new api.AdminApiError('Refresh failed'); }; },
  };
}
function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return undefined;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'string' || typeof node === 'number' ? String(node) : text(node?.props?.children ?? '');
}
const button = (tree, label) => find(tree, node => node.type === 'button' && (text(node).trim() === label || node.props['aria-label'] === label));
async function loaded(status) {
  const view = harness([{ id: 1, name: 'Landmark', status, images: [], timelines: [] }]);
  view.render(); view.flush(); await tick();
  button(view.render(), 'Heritage Sites').props.onClick();
  view.render(); view.flush(); await tick();
  return view;
}

test('active site asks to archive before sending an authenticated status-checked request', async () => {
  const view = await loaded('active');
  button(view.render(), 'Archive Site').props.onClick();
  assert.equal(view.requests.length, 0);
  assert.equal(view.confirmation.message, 'Archive this heritage site? It will be hidden from visitors but can still be restored from Admin.');
  assert.equal(view.confirmation.confirmText, 'Archive Site');
  assert.equal(view.confirmation.cancelText, 'Cancel');
  await view.confirmation.onConfirm();
  assert.deepEqual(JSON.parse(view.requests[0].body), { expected_status: 'active', permanent: false });
  assert.equal(view.requests[0].headers.Authorization, 'Bearer admin-token');
  assert.ok(text(view.render()).includes('Landmark'));
  assert.ok(button(view.render(), 'Delete Permanently'));
});

test('archived site confirms irreversible deletion by name, removes row and shows success', async () => {
  const view = await loaded('archived');
  assert.equal(button(view.render(), 'Restore'), undefined);
  const action = button(view.render(), 'Delete Permanently');
  assert.match(action.props.className, /text-red-600/);
  action.props.onClick();
  assert.equal(view.requests.length, 0);
  assert.equal(view.confirmation.title, 'Permanently delete Landmark?');
  assert.equal(view.confirmation.message, 'This will permanently remove the heritage site and its related records. This action cannot be undone.');
  assert.equal(view.confirmation.confirmText, 'Delete Permanently');
  assert.equal(view.confirmation.cancelText, 'Cancel');
  await view.confirmation.onConfirm();
  assert.deepEqual(JSON.parse(view.requests[0].body), { expected_status: 'archived', permanent: true });
  assert.equal(text(view.render()).includes('Landmark'), false);
  assert.deepEqual(view.toasts[0], ['success', 'Landmark was permanently deleted.']);
});

test('stale permanent deletion shows conflict and retains the Admin row', async () => {
  const view = await loaded('archived');
  button(view.render(), 'Delete Permanently').props.onClick();
  fetch = async () => reply({ message: 'internal details' }, 409);
  await view.confirmation.onConfirm();
  assert.ok(text(view.render()).includes('Landmark'));
  assert.deepEqual(view.toasts[0], ['error', 'Site status changed. Reload the data and try again.']);
});

test('deletion remains removed locally even when the subsequent refresh fails', async () => {
  const view = await loaded('archived');
  button(view.render(), 'Delete Permanently').props.onClick();
  view.failRefresh();
  await view.confirmation.onConfirm();
  assert.deepEqual(view.toasts[0], ['success', 'Landmark was permanently deleted.']);
  assert.equal(text(view.render()).includes('Landmark'), false);
});

test('duplicate confirmed requests are locked while deletion is pending', async () => {
  const view = await loaded('archived');
  button(view.render(), 'Delete Permanently').props.onClick();
  let finish, count = 0;
  fetch = async () => { count++; return new Promise(resolve => { finish = () => resolve(reply({})); }); };
  const pending = view.confirmation.onConfirm();
  await view.confirmation.onConfirm();
  assert.equal(count, 1);
  assert.equal(button(view.render(), 'Processing...').props.disabled, true);
  finish(); await pending;
});
