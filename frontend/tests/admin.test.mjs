import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test, { beforeEach } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const compile = (source, module = ts.ModuleKind.CommonJS) => ts.transpileModule(source, {
  compilerOptions: { module, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/api/client.ts'), ts.ModuleKind.ESNext)).toString('base64')}`);
const adminData = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/utils/adminData.ts'), ts.ModuleKind.ESNext)).toString('base64')}`);
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const tick = () => new Promise((resolve) => setImmediate(resolve));
const site = { id: 1, name: 'Original site', address: 'Address', status: 'active', timelines: [
  { id: 4, heritage_site_id: 1, year: '1920', title: 'Original timeline' },
] };
const lists = {
  '/api/heritage-sites': [site],
  '/api/events': [{ id: 2, title: 'Original event', location: 'Location', event_date: '2026-10-06 18:24:35' }],
  '/api/site-images': [{ id: 3, heritage_site_id: 1, image_path: 'test.jpg', caption: 'Original image' }],
};
const resources = [
  { kind: 'site', tab: 'Heritage Sites', add: 'Add Site', route: '/api/heritage-sites', id: 1, field: 'name', save: 'Save Heritage Site', item: 'Original site' },
  { kind: 'event', tab: 'Events', add: 'Add Event', route: '/api/events', id: 2, field: 'title', save: 'Save Event', item: 'Original event' },
  { kind: 'image', tab: 'Site Images', add: 'Add Image Reference', route: '/api/site-images', id: 3, field: 'image_path', save: 'Save Image', item: 'Original image' },
  { kind: 'timeline', tab: 'Timelines', add: 'Add Timeline', route: '/api/heritage-timelines', id: 4, field: 'title', save: 'Save Timeline', item: 'Original timeline' },
];

beforeEach(() => {
  const storage = new Map([['chis_jwt_token', 'admin-token']]);
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
});

function harness() {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let callbacks = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback) {
      const index = cursor++;
      if (!effects[index]) { effects[index] = true; callbacks.push(callback); }
    },
  };
  const exports = {};
  vm.runInNewContext(compile(read('../src/views/AdminView.tsx')), {
    exports, Error, console, confirm: () => true,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../api/client') return api;
      if (name === '../utils/adminData') return adminData;
      return new Proxy({}, { get: (_, key) => Object.assign(() => null, { displayName: String(key) }) });
    },
  });
  return {
    render: () => { cursor = 0; return exports.AdminView({ user: { id: '1', name: 'Admin', role: 'admin' }, onLogout() {} }); },
    flush: () => { const pending = callbacks; callbacks = []; pending.forEach((callback) => callback()); },
  };
}

function find(node, predicate) {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return undefined;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return node?.props ? text(node.props.children) : '';
}
const button = (tree, label) => find(tree, (node) => node.type === 'button' && text(node).trim() === label);
const form = (tree, kind) => find(tree, (node) => node.type === 'form' && node.props.id === `admin-${kind}-form`);
const deleteButton = (tree) => find(tree, (node) => node.type === 'button'
  && (node.props.title === 'Delete' || find(node.props.children, (child) => child.type?.displayName === 'Trash2')));

async function loaded(resource, mutation, data = lists) {
  const calls = [];
  fetch = async (url, options = {}) => {
    calls.push([url, options]);
    if (options.method && options.method !== 'GET') return mutation(url, options);
    return reply(data[url] ?? []);
  };
  const view = harness();
  assert.ok(text(view.render()).includes('Loading admin data...'));
  view.flush();
  await tick();
  if (resource) button(view.render(), resource.tab).props.onClick();
  return { view, calls };
}

for (const resource of resources) {
  test(`${resource.kind}: form submits once, shows pending, closes on success, and refreshes`, async () => {
    let resolve;
    const { view, calls } = await loaded(resource, () => new Promise((done) => { resolve = done; }));
    button(view.render(), resource.add).props.onClick();
    let tree = view.render();
    const save = button(tree, resource.save);
    assert.equal(save.props.type, 'submit');
    assert.equal(save.props.form, `admin-${resource.kind}-form`);
    assert.equal(save.props.onClick, undefined);
    assert.ok(find(form(tree, resource.kind), (node) => node.props?.required));
    const submit = form(tree, resource.kind).props.onSubmit;
    const first = submit({ preventDefault() {} });
    await submit({ preventDefault() {} });
    tree = view.render();
    assert.equal(button(tree, 'Saving...').props.disabled, true);
    assert.equal(calls.filter(([, options]) => options.method === 'POST').length, 1);
    resolve(reply({ id: 10 }, 201));
    await first;
    tree = view.render();
    assert.equal(form(tree, resource.kind), undefined);
    assert.ok(text(find(tree, (node) => node.props?.role === 'status')).includes('created successfully'));
    assert.equal(calls.filter(([url, options]) => url === '/api/heritage-sites' && options.method === 'GET').length, 2);
  });

  test(`${resource.kind}: validation failure preserves values, and retry clears the error`, async () => {
    let rejectNext = false;
    const { view } = await loaded(resource, () => rejectNext ? reply({ id: 10 }, 201)
      : reply({ message: 'Internal response ignored', errors: { [resource.field]: ['Please provide a valid value.'] } }, 422));
    button(view.render(), resource.add).props.onClick();
    let tree = view.render();
    const input = find(form(tree, resource.kind), (node) => ['input', 'textarea'].includes(node.type)
      && node.props.onChange && (node.props.placeholder === 'Site Name' || node.props.placeholder === 'Event Title'
        || node.props.placeholder === 'e.g. heritage-sites/photo.jpg' || node.props.placeholder === 'Timeline Event Title'));
    input.props.onChange({ target: { value: 'Entered value' } });
    tree = view.render();
    await form(tree, resource.kind).props.onSubmit({ preventDefault() {} });
    tree = view.render();
    assert.ok(form(tree, resource.kind));
    assert.ok(text(tree).includes('Please provide a valid value.'));
    assert.ok(find(form(tree, resource.kind), (node) => node.props?.value === 'Entered value'));
    rejectNext = true;
    await form(tree, resource.kind).props.onSubmit({ preventDefault() {} });
    assert.equal(form(view.render(), resource.kind), undefined);
    assert.equal(text(view.render()).includes('Please provide a valid value.'), false);
  });

  test(`${resource.kind}: delete is locked while pending and succeeds only after confirmation from backend`, async () => {
    let resolve;
    const { view, calls } = await loaded(resource, () => new Promise((done) => { resolve = done; }));
    const action = deleteButton(view.render());
    const first = action.props.onClick();
    await action.props.onClick();
    assert.equal(calls.filter(([, options]) => options.method === 'DELETE').length, 1);
    const pending = find(view.render(), (node) => node.type === 'button' && node.props['aria-busy']);
    assert.equal(pending.props.disabled, true);
    assert.equal(text(pending), 'Processing...');
    assert.ok(text(view.render()).includes(resource.item));
    resolve(reply({ message: 'Success' }));
    await first;
    assert.ok(text(find(view.render(), (node) => node.props?.role === 'status')).includes('successfully'));
    assert.equal(calls.filter(([url, options]) => url === '/api/heritage-sites' && options.method === 'GET').length, 2);
  });

  test(`${resource.kind}: failed delete keeps the item and displays a safe error`, async () => {
    const { view, calls } = await loaded(resource, () => new Response('<html>SQLSTATE private trace</html>', { status: 500 }));
    await deleteButton(view.render()).props.onClick();
    assert.ok(text(view.render()).includes(resource.item));
    assert.ok(text(find(view.render(), (node) => node.props?.role === 'alert')).includes('request failed'));
    assert.equal(text(view.render()).includes('SQLSTATE'), false);
    assert.equal(calls.filter(([url, options]) => url === '/api/heritage-sites' && options.method === 'GET').length, 1);
  });

  test(`${resource.kind}: edit saves use PUT and show update feedback`, async () => {
    const { view, calls } = await loaded(resource, () => reply({ id: resource.id }));
    const edit = find(view.render(), (node) => node.type === 'button' && (node.props.title === 'Edit'
      || find(node.props.children, (child) => child.type?.displayName === 'Edit3')));
    edit.props.onClick();
    await form(view.render(), resource.kind).props.onSubmit({ preventDefault() {} });
    assert.equal(calls.find(([, options]) => options.method === 'PUT')[0], `${resource.route}/${resource.id}`);
    assert.ok(text(view.render()).includes('updated successfully'));
  });
}

for (const failedRoute of Object.keys(lists)) {
  test(`${failedRoute}: failed load is distinct from empty data and can be retried`, async () => {
    let failed = true;
    fetch = async (url) => url === failedRoute && failed ? reply({}, 500) : reply([]);
    const view = harness();
    view.render(); view.flush(); await tick();
    assert.ok(text(view.render()).includes('Unable to load admin data.'));
    assert.equal(text(view.render()).includes('Total Heritage Sites'), false);
    assert.equal(text(view.render()).includes('No heritage sites found.'), false);
    failed = false;
    await button(view.render(), 'Retry').props.onClick();
    await tick();
    assert.ok(text(view.render()).includes('Total Heritage Sites'));
  });
}

test('successful empty lists show existing empty states', async () => {
  const { view } = await loaded(null, () => reply({}), {});
  for (const [tab, message] of [['Heritage Sites', 'No heritage sites found.'], ['Events', 'No events found.'],
    ['Site Images', 'No image references added yet.'], ['Timelines', 'No timelines found.']]) {
    button(view.render(), tab).props.onClick();
    assert.ok(text(view.render()).includes(message));
  }
});

test('successful mutation followed by failed refresh remains a success with a retryable load error', async () => {
  let failLoad = false;
  const { view } = await loaded(resources[0], () => { failLoad = true; return reply({ id: 10 }, 201); });
  button(view.render(), 'Add Site').props.onClick();
  fetch = async (_, options) => options.method === 'POST' ? (failLoad = true, reply({ id: 10 }, 201))
    : reply([], failLoad ? 500 : 200);
  await form(view.render(), 'site').props.onSubmit({ preventDefault() {} });
  assert.equal(form(view.render(), 'site'), undefined);
  assert.ok(text(view.render()).includes('created successfully'));
  assert.ok(text(view.render()).includes('Unable to load admin data.'));
});

test('admin API errors preserve status and validation while public event fallback remains unchanged', async () => {
  fetch = async (_, options) => {
    assert.equal(options.headers.Authorization, 'Bearer admin-token');
    return reply({ message: 'Private server details', errors: { name: ['The name field is required.'] } }, 422);
  };
  await assert.rejects(api.apiCreateSite({}), (error) => error instanceof api.AdminApiError
    && error.status === 422 && error.validationErrors.name[0] === 'The name field is required.'
    && !error.message.includes('Private'));
  fetch = async () => { throw new Error('Offline'); };
  await assert.rejects(api.apiFetchRawSites(), /Check your connection/);
  assert.deepEqual(await api.apiFetchEvents(), []);
});

test('starting a new form clears the previous save error', async () => {
  const { view } = await loaded(resources[0], () => reply({ errors: { name: ['The name field is required.'] } }, 422));
  button(view.render(), 'Add Site').props.onClick();
  await form(view.render(), 'site').props.onSubmit({ preventDefault() {} });
  assert.ok(text(view.render()).includes('The name field is required.'));
  button(view.render(), 'Cancel').props.onClick();
  button(view.render(), 'Add Site').props.onClick();
  assert.equal(text(view.render()).includes('The name field is required.'), false);
});

test('malformed admin lists are errors, not empty results', async () => {
  fetch = async () => reply({ message: 'not an array' });
  for (const load of [api.apiFetchRawSites, api.apiFetchAdminEvents, api.apiFetchSiteImages]) {
    await assert.rejects(load(), /invalid list/);
  }
});

test('event editing shows the MySQL calendar date and preserves its time when unchanged', async () => {
  const { view, calls } = await loaded(resources[1], () => reply({ id: 2 }));
  find(view.render(), (node) => node.type === 'button' && node.props.title === 'Edit').props.onClick();
  const date = find(form(view.render(), 'event'), (node) => node.type === 'input' && node.props.type === 'date');
  assert.equal(date.props.value, '2026-10-06');
  await form(view.render(), 'event').props.onSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(calls.find(([, options]) => options.method === 'PUT')[1].body).event_date, '2026-10-06 18:24:35');
});

test('changing the event calendar date preserves time without timezone conversion', async () => {
  const { view, calls } = await loaded(resources[1], () => reply({ id: 2 }));
  find(view.render(), (node) => node.type === 'button' && node.props.title === 'Edit').props.onClick();
  find(form(view.render(), 'event'), (node) => node.type === 'input' && node.props.type === 'date')
    .props.onChange({ target: { value: '' } });
  find(form(view.render(), 'event'), (node) => node.type === 'input' && node.props.type === 'date')
    .props.onChange({ target: { value: '2026-10-10' } });
  await form(view.render(), 'event').props.onSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(calls.find(([, options]) => options.method === 'PUT')[1].body).event_date, '2026-10-10 18:24:35');
});

test('date-only and ISO values retain their displayed calendar date', () => {
  for (const value of ['2026-10-05', '2026-10-05 00:00:00', '2026-10-05T23:30:00-08:00']) {
    assert.equal(adminData.eventDateForInput(value), '2026-10-05');
  }
  assert.equal(adminData.eventDateForSubmission('2026-10-05'), '2026-10-05');
  assert.equal(adminData.eventDateForSubmission('2026-10-05T23:30:00-08:00'), '2026-10-05 23:30:00');
  assert.equal(adminData.replaceEventDate(undefined, '2026-10-05'), '2026-10-05');
});

test('image references use same-origin storage or a configured backend and preserve external URLs', () => {
  assert.equal(adminData.storageImageUrl('heritage-sites/photo.jpg'), '/storage/heritage-sites/photo.jpg');
  assert.equal(adminData.storageImageUrl('/storage/photo.jpg'), '/storage/photo.jpg');
  assert.equal(adminData.storageImageUrl('storage/photo.jpg', 'https://backend.example/api/'), 'https://backend.example/storage/photo.jpg');
  assert.equal(adminData.storageImageUrl('photo.jpg', 'http://127.0.0.1:8000'), 'http://127.0.0.1:8000/storage/photo.jpg');
  assert.equal(adminData.storageImageUrl('https://images.example/photo.jpg'), 'https://images.example/photo.jpg');
  assert.equal(adminData.storageImageUrl('//images.example/photo.jpg'), '//images.example/photo.jpg');
});

test('admin actions describe archive, cancellation, and image references accurately', async () => {
  const { view } = await loaded(resources[0], () => reply({}));
  assert.ok(find(view.render(), (node) => node.type === 'button' && node.props.title === 'Archive'));
  assert.equal(find(view.render(), (node) => node.type === 'button' && node.props.title === 'Delete'), undefined);
  button(view.render(), 'Events').props.onClick();
  assert.ok(find(view.render(), (node) => node.type === 'button' && (node.props.title === 'Delete Event' || node.props.title === 'Cancel Event')));
  button(view.render(), 'Site Images').props.onClick();
  assert.ok(button(view.render(), 'Add Image Reference'));
  assert.ok(find(view.render(), (node) => node.type === 'button' && node.props.title === 'Remove Image Reference'));
  assert.equal(text(view.render()).includes('Upload'), false);
  button(view.render(), 'Add Image Reference').props.onClick();
  assert.ok(text(view.render()).includes('does not upload a file'));
});

test('timeline and image edits submit the selected parent site', async () => {
  for (const resource of [resources[2], resources[3]]) {
    const { view, calls } = await loaded(resource, () => reply({ id: resource.id }));
    find(view.render(), (node) => node.type === 'button' && (node.props.title === 'Edit'
      || find(node.props.children, (child) => child.type?.displayName === 'Edit3'))).props.onClick();
    find(form(view.render(), resource.kind), (node) => node.type === 'select')
      .props.onChange({ target: { value: '7' } });
    await form(view.render(), resource.kind).props.onSubmit({ preventDefault() {} });
    assert.equal(JSON.parse(calls.find(([, options]) => options.method === 'PUT')[1].body).heritage_site_id, 7);
  }
});
