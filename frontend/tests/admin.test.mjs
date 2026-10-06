import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test, { beforeEach } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const imageModuleUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(read('../src/utils/heritageImages.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText).toString('base64')}`;
const compile = (source, module = ts.ModuleKind.CommonJS) => ts.transpileModule(source.replace(/(['"'])(?:\.\.\/utils\/heritageImages|\.\/heritageImages)\1/g, JSON.stringify(imageModuleUrl)), {
  compilerOptions: { module, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/api/client.ts'), ts.ModuleKind.ESNext)).toString('base64')}`);
const imageHelpers = await import(imageModuleUrl);
const adminData = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/utils/adminData.ts'), ts.ModuleKind.ESNext)).toString('base64')}`);
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const tick = () => new Promise((resolve) => setImmediate(resolve));
const site = { id: 1, name: 'Original site', address: 'Address', status: 'active', timelines: [
  { id: 4, heritage_site_id: 1, year: '1920', title: 'Original timeline' },
] };
const lists = {
  '/api/admin/heritage-sites': [site],
  '/api/events': [{ id: 2, title: 'Original event', location: 'Location', event_date: '2026-10-06 18:24:35' }],
  '/api/admin/site-images': [{ id: 3, heritage_site_id: 1, image_path: 'test.jpg', caption: 'Original image' }],
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
    useEffect(callback, deps) {
      const index = cursor++;
      if (!effects[index] || (deps?.length === 1 && typeof deps[0] !== 'function' && !Object.is(effects[index].deps?.[0], deps[0]))) {
        const previous = effects[index];
        callbacks.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compile(read('../src/views/AdminView.tsx')), {
    exports, Error, console, URL, confirm: () => true,
    require(name) {
      if (name === imageModuleUrl) return imageHelpers;
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../api/client') return api;
      if (name === '../utils/adminData') return adminData;
      if (name === '../data/heritageCategories') return { HERITAGE_CATEGORIES: ['All', 'Historical Buildings', 'Churches', 'Museums', 'Monuments', 'Cultural Sites'] };
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
    assert.equal(calls.filter(([url, options]) => url === '/api/admin/heritage-sites' && options.method === 'GET').length, 2);
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
    assert.equal(calls.filter(([url, options]) => url === '/api/admin/heritage-sites' && options.method === 'GET').length, 2);
  });

  test(`${resource.kind}: failed delete keeps the item and displays a safe error`, async () => {
    const { view, calls } = await loaded(resource, () => new Response('<html>SQLSTATE private trace</html>', { status: 500 }));
    await deleteButton(view.render()).props.onClick();
    assert.ok(text(view.render()).includes(resource.item));
    assert.ok(text(find(view.render(), (node) => node.props?.role === 'alert')).includes('request failed'));
    assert.equal(text(view.render()).includes('SQLSTATE'), false);
    assert.equal(calls.filter(([url, options]) => url === '/api/admin/heritage-sites' && options.method === 'GET').length, 1);
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
  button(view.render(), 'Add Image Reference').props.onClick();
  assert.ok(text(view.render()).includes('Upload Image'));
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

test('heritage edit preserves zero coordinates, supports restoration and sends only site fields', async () => {
  const archived = { ...site, status: 'archived', category: 'Churches', latitude: 0, longitude: 0,
    created_by: 99, images: [{ id: 3 }], description: 'Overview', history: 'History' };
  const { view, calls } = await loaded(resources[0], () => reply(archived), {
    ...lists, '/api/admin/heritage-sites': [archived],
  });
  find(view.render(), node => node.type === 'button' && node.props.title === 'Edit').props.onClick();
  let tree = view.render();
  assert.equal(find(tree, node => node.type === 'input' && node.props.placeholder === 'e.g. 15.031').props.value, 0);
  assert.equal(find(tree, node => node.type === 'input' && node.props.placeholder === 'e.g. 120.689').props.value, 0);
  const category = find(tree, node => node.type === 'select' && node.props.value === 'Churches');
  assert.deepEqual(category.props.children[2].map(node => node.props.value), [
    'Historical Buildings', 'Churches', 'Museums', 'Monuments', 'Cultural Sites',
  ]);
  find(tree, node => node.type === 'select' && node.props.value === 'archived')
    .props.onChange({ target: { value: 'active' } });
  tree = view.render();
  find(tree, node => node.type === 'input' && node.props.placeholder === 'e.g. 15.031')
    .props.onChange({ target: { value: '15oops' } });
  await form(view.render(), 'site').props.onSubmit({ preventDefault() {} });
  const payload = JSON.parse(calls.find(([, options]) => options.method === 'PUT')[1].body);
  assert.equal(payload.status, 'active');
  assert.equal(payload.latitude, '15oops'); // Backend must reject it, rather than receiving a truncated 15.
  assert.equal(payload.longitude, '0');
  for (const field of ['id', 'created_by', 'images', 'timelines']) assert.equal(field in payload, false);
});

test('visitor form loads saved values and sends unchanged, edited and cleared values', async () => {
  const values = { opening_hours: 'Weekdays', entrance_fee: 'Admission on request',
    accessibility_notes: 'Ground floor', visit_notes: 'Call first', contact_information: 'Tourism desk' };
  const record = { ...site, ...values, description: 'Overview', history: 'History' };
  const { view, calls } = await loaded(resources[0], () => reply(record), {
    ...lists, '/api/admin/heritage-sites': [record],
  });
  find(view.render(), node => node.type === 'button' && node.props.title === 'Edit').props.onClick();
  for (const [field, value] of Object.entries(values)) {
    const input = find(view.render(), node => node.type === 'textarea' && node.props.name === field);
    assert.equal(input.props.value, value);
    assert.equal(input.props.required, undefined);
  }
  await form(view.render(), 'site').props.onSubmit({ preventDefault() {} });
  let payload = JSON.parse(calls.find(([, options]) => options.method === 'PUT')[1].body);
  for (const [field, value] of Object.entries(values)) assert.equal(payload[field], value);
  find(view.render(), node => node.type === 'button' && node.props.title === 'Edit').props.onClick();
  find(view.render(), node => node.props?.name === 'opening_hours').props.onChange({ target: { value: '  Updated hours  ' } });
  find(view.render(), node => node.props?.name === 'entrance_fee').props.onChange({ target: { value: '   ' } });
  await form(view.render(), 'site').props.onSubmit({ preventDefault() {} });
  payload = JSON.parse(calls.filter(([, options]) => options.method === 'PUT').at(-1)[1].body);
  assert.equal(payload.opening_hours, 'Updated hours');
  assert.equal(payload.entrance_fee, null);
  assert.equal(payload.visit_notes, values.visit_notes);
  assert.equal(payload.description, 'Overview');
  assert.equal(payload.history, 'History');
});

test('new heritage form leaves visitor information blank and submits nulls', async () => {
  const { view, calls } = await loaded(resources[0], () => reply({ id: 8 }));
  button(view.render(), 'Add Site').props.onClick();
  const fields = ['opening_hours', 'entrance_fee', 'accessibility_notes', 'visit_notes', 'contact_information'];
  for (const field of fields) assert.equal(find(view.render(), node => node.props?.name === field).props.value, '');
  await form(view.render(), 'site').props.onSubmit({ preventDefault() {} });
  const payload = JSON.parse(calls.find(([, options]) => options.method === 'POST')[1].body);
  for (const field of fields) assert.equal(payload[field], null);
});

test('image form round trips cover/order and still reassigns the parent', async () => {
  const record = { id: 3, heritage_site_id: 1, image_path: 'https://example.test/image.jpg', caption: 'Caption', is_cover: true, sort_order: 9 };
  const { view, calls } = await loaded(resources[2], () => reply(record), {
    ...lists, '/api/admin/site-images': [record],
  });
  find(view.render(), node => node.type === 'button' && (node.props.title === 'Edit'
    || find(node.props.children, child => child.type?.displayName === 'Edit3'))).props.onClick();
  assert.equal(find(view.render(), node => node.props?.name === 'is_cover').props.checked, true);
  assert.equal(find(view.render(), node => node.props?.name === 'sort_order').props.value, 9);
  await form(view.render(), 'image').props.onSubmit({ preventDefault() {} });
  let payload = JSON.parse(calls.find(([, options]) => options.method === 'PUT')[1].body);
  assert.equal(payload.is_cover, true);
  assert.equal(payload.sort_order, 9);
  assert.equal(payload.caption, 'Caption');
  find(view.render(), node => node.type === 'button' && (node.props.title === 'Edit'
    || find(node.props.children, child => child.type?.displayName === 'Edit3'))).props.onClick();
  find(view.render(), node => node.props?.name === 'is_cover').props.onChange({ target: { checked: false } });
  find(view.render(), node => node.props?.name === 'sort_order').props.onChange({ target: { value: '2' } });
  find(form(view.render(), 'image'), node => node.type === 'select').props.onChange({ target: { value: '7' } });
  await form(view.render(), 'image').props.onSubmit({ preventDefault() {} });
  payload = JSON.parse(calls.filter(([, options]) => options.method === 'PUT').at(-1)[1].body);
  assert.equal(payload.is_cover, false);
  assert.equal(payload.sort_order, '2');
  assert.equal(payload.heritage_site_id, 7);
  assert.equal('id' in payload, false);
});

test('image file picker previews locally and submits authenticated multipart without manual content type', async () => {
  const { view, calls } = await loaded(resources[2], () => reply({ id: 3 }));
  button(view.render(), 'Add Image Reference').props.onClick();
  const file = new File(['test image bytes'], 'local.png', { type: 'image/png' });
  find(view.render(), node => node.props?.id === 'admin-site-image-upload').props.onChange({ target: { files: [file] } });
  view.render(); view.flush();
  let tree = view.render();
  assert.ok(text(tree).includes('local.png'));
  assert.ok(find(tree, node => node.props?.id === 'admin-site-image-preview').props.src.startsWith('blob:'));
  assert.equal(find(tree, node => node.props?.placeholder === 'e.g. heritage-sites/photo.jpg').props.required, false);
  await form(tree, 'image').props.onSubmit({ preventDefault() {} });
  const options = calls.find(([url, options]) => url === '/api/site-images' && options.method === 'POST')[1];
  assert.ok(options.body instanceof FormData);
  assert.equal(options.body.get('image').name, 'local.png');
  assert.equal(options.body.get('is_cover'), '0');
  assert.equal(options.body.get('sort_order'), '0');
  assert.equal(options.body.has('image_path'), false);
  assert.equal(options.headers.Authorization, 'Bearer admin-token');
  assert.equal(options.headers['Content-Type'], undefined);
});

test('image upload update uses method override and preserves Laravel validation errors', async () => {
  const file = new File(['bytes'], 'local.png', { type: 'image/png' });
  let captured;
  fetch = async (url, options) => { captured = [url, options]; return reply({ errors: { image: ['The image is invalid.'] } }, 422); };
  await assert.rejects(api.apiUpdateSiteImage('3', { imageFile: file, heritage_site_id: 1, caption: 'Caption', is_cover: true, sort_order: 5 }), error => {
    assert.equal(error.status, 422);
    assert.deepEqual(error.validationErrors.image, ['The image is invalid.']);
    return true;
  });
  assert.equal(captured[1].method, 'POST');
  assert.equal(captured[1].body.get('_method'), 'PUT');
  assert.equal(captured[1].body.get('caption'), 'Caption');
  assert.equal(captured[1].body.get('is_cover'), '1');
});


test('timeline form loads and saves display year and explicit order, including reassignment', async () => {
  const record = { id: 4, heritage_site_id: 1, year: 'circa 1920', title: 'Original timeline', description: 'Recorded history', sort_order: 8 };
  const { view, calls } = await loaded(resources[3], () => reply(record), { ...lists,
    '/api/admin/heritage-sites': [{ ...site, timelines: [record] }, { id: 7, name: 'Other site', timelines: [] }] });
  const edit = () => find(view.render(), node => node.type === 'button' && (node.props.title === 'Edit' || find(node.props.children, child => child.type?.displayName === 'Edit3'))).props.onClick();
  edit();
  assert.equal(find(view.render(), node => node.props?.id === 'admin-timeline-order').props.value, 8);
  assert.equal(find(view.render(), node => node.type === 'input' && node.props.value === 'circa 1920').props.type, 'text');
  await form(view.render(), 'timeline').props.onSubmit({ preventDefault() {} });
  let payload = JSON.parse(calls.find(([, options]) => options.method === 'PUT')[1].body);
  assert.equal(payload.sort_order, 8); assert.equal(payload.year, 'circa 1920');
  edit();
  find(view.render(), node => node.props?.id === 'admin-timeline-order').props.onChange({ target: { value: '3' } });
  find(form(view.render(), 'timeline'), node => node.type === 'select').props.onChange({ target: { value: '7' } });
  await form(view.render(), 'timeline').props.onSubmit({ preventDefault() {} });
  payload = JSON.parse(calls.filter(([, options]) => options.method === 'PUT').at(-1)[1].body);
  assert.equal(payload.sort_order, '3'); assert.equal(payload.heritage_site_id, 7);
  button(view.render(), 'Add Timeline').props.onClick();
  assert.equal(find(view.render(), node => node.props?.id === 'admin-timeline-order').props.value, 0);
  await form(view.render(), 'timeline').props.onSubmit({ preventDefault() {} });
  const created = JSON.parse(calls.find(([url, options]) => url === '/api/heritage-timelines' && options.method === 'POST')[1].body);
  assert.equal(created.sort_order, 0);
});
