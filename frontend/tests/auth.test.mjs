import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test, { beforeEach } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const imageModuleUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(read('../src/utils/heritageImages.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText).toString('base64')}`;
const compile = (source, module = ts.ModuleKind.CommonJS) => ts.transpileModule(source.replaceAll('import.meta.env.VITE_GOOGLE_CLIENT_ID', "''").replace(/(['"'])(?:\.\.\/utils\/heritageImages|\.\/heritageImages)\1/g, JSON.stringify(imageModuleUrl)), {
  compilerOptions: { module, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const navigation = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/utils/heritageNavigation.ts'), ts.ModuleKind.ESNext)).toString('base64')}`);
const api = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/api/client.ts'), ts.ModuleKind.ESNext)).toString('base64')}`);
const admin = { id: 1, name: 'Administrator', email: 'curator@example.com', role: 'admin' };
const traveler = { id: 2, name: 'Visitor', email: 'adminsf@csfp.gov.ph', role: 'traveler' };
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.fetch = async () => { throw new Error('Unexpected request'); };
});

// Exercise component callbacks/effects without adding a browser test dependency.
function componentHarness(path, exportName, props = {}, overrides = {}) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let pending = [];
  const hooks = {
    lazy(loader) {
      return Object.assign(() => null, { displayName: /module\.(\w+)/.exec(String(loader))?.[1] || 'LazyView' });
    },
    Suspense: Object.assign(() => null, { displayName: 'Suspense' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
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
  const stubs = new Map();
  const exports = {};
  vm.runInNewContext(compile(read(path)), {
    exports, console, Error, localStorage: globalThis.localStorage,
    window: { scrollTo() {}, addEventListener() {}, removeEventListener() {} },
    require(name) {
      if (name.endsWith('/hooks/useToast')) return { useToast: () => ({ addToast() {} }) };
      if (name.endsWith('/utils/heritageNavigation')) return navigation;
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name.endsWith('/api/client')) return {
        ...api, apiFetchSites: async () => [], apiFetchEvents: async () => [], ...overrides,
      };
      if (name.endsWith('/data/eventsData')) return { CULTURAL_EVENTS: [] };
      if (name === 'canvas-confetti') return { default() {} };
      if (!stubs.has(name)) stubs.set(name, new Proxy({}, {
        get: (_, key) => {
          const stub = () => null;
          stub.displayName = String(key);
          return stub;
        },
      }));
      return stubs.get(name);
    },
  });
  return {
    render() { cursor = 0; return exports[exportName](props); },
    flushEffects() { const callbacks = pending; pending = []; callbacks.forEach((callback) => callback()); },
  };
}

function find(node, predicate) {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

function loginHarness() {
  const loggedIn = [];
  let navigations = 0;
  const harness = componentHarness('../src/components/AuthModal.tsx', 'AuthModal', {
    isOpen: true, user: null, onClose() {}, onLogout() {},
    onLogin: (user) => loggedIn.push(user), onNavigateAdmin: () => navigations++,
  });
  return { harness, loggedIn, navigations: () => navigations };
}

async function submitLogin(harness, email, password) {
  let tree = harness.render();
  find(tree, (node) => node.type === 'input' && node.props.type === 'email')
    .props.onChange({ target: { value: email } });
  find(tree, (node) => node.type === 'input' && node.props.type === 'password')
    .props.onChange({ target: { value: password } });
  tree = harness.render();
  await find(tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
}

for (const [label, user, allowed] of [['admin', admin, true], ['traveler', traveler, false]]) {
  test(`${label} login uses only the backend role`, async () => {
    fetch = async (_, options) => {
      assert.equal(options.headers.Accept, 'application/json');
      assert.equal(JSON.parse(options.body).password, ' password with spaces ');
      return response({ access_token: 'server-token', token_type: 'bearer', expires_in: 3600, user });
    };
    const flow = loginHarness();
    await submitLogin(flow.harness, user.email, ' password with spaces ');
    assert.equal(flow.loggedIn.length, 1);
    assert.equal(flow.loggedIn[0].role, user.role);
    assert.equal(flow.loggedIn[0].id, String(user.id));
    assert.deepEqual(flow.loggedIn[0].stamps, []);
    assert.equal(flow.navigations(), allowed ? 1 : 0);
    assert.equal(api.getJwtToken(), 'server-token');
  });
}

for (const email of ['adminsf@csfp.gov.ph', 'unknown@example.com']) {
  test(`rejected login for ${email} creates no user or admin navigation`, async () => {
    fetch = async () => response({ error: 'Invalid credentials' }, 401);
    const flow = loginHarness();
    await submitLogin(flow.harness, email, 'incorrect-password');
    assert.equal(flow.loggedIn.length, 0);
    assert.equal(flow.navigations(), 0);
    assert.equal(api.getJwtToken(), null);
    assert.ok(find(flow.harness.render(), (node) => node.props?.children === 'Incorrect email or password.'));
  });
}

test('network failures never create a user and show a connection error', async () => {
  fetch = async () => { throw new Error('private network details'); };
  const flow = loginHarness();
  await submitLogin(flow.harness, admin.email, 'password');
  assert.equal(flow.loggedIn.length, 0);
  assert.equal(flow.navigations(), 0);
  assert.ok(find(flow.harness.render(), (node) => node.props?.children?.includes?.('Check your internet connection')));
});

test('server HTML and malformed success responses are never trusted or displayed', async () => {
  fetch = async () => new Response('<html>private stack trace</html>', { status: 500 });
  await assert.rejects(api.apiLogin(admin.email, 'password'), /temporarily unavailable/);
  fetch = async () => new Response('<html>private stack trace</html>');
  await assert.rejects(api.apiLogin(admin.email, 'password'), /unexpected response/);
  fetch = async () => response({ access_token: 'fake-token', user: { ...admin, id: 'admin-local' } });
  await assert.rejects(api.apiLogin(admin.email, 'password'), /Invalid authentication response/);
  assert.equal(api.getJwtToken(), null);
});

for (const outcome of ['missing-token', 'rejected', 'traveler', 'network-failure']) {
  test(`cached admin profile cannot grant access: ${outcome}`, async () => {
    localStorage.setItem('sf_user_profile', JSON.stringify({ ...admin, isLoggedIn: true }));
    if (outcome !== 'missing-token') api.setJwtToken('stale-token');
    fetch = async () => {
      if (outcome === 'network-failure') throw new Error('Offline');
      return outcome === 'traveler' ? response({ user: traveler }) : response({}, 401);
    };
    const harness = componentHarness('../src/App.tsx', 'default');
    let tree = harness.render();
    assert.equal(find(tree, (node) => node.type?.displayName === 'Header').props.user, null);
    harness.flushEffects();
    await tick();
    tree = harness.render();
    const header = find(tree, (node) => node.type?.displayName === 'Header');
    assert.equal(header.props.user?.role === 'admin', false);
    header.props.onToggleAdminMode();
    tree = harness.render();
    assert.equal(find(tree, (node) => node.type?.displayName === 'AdminView'), undefined);
    assert.ok(find(tree, (node) => node.props?.children === 'Access Denied'));
    if (outcome === 'rejected') assert.equal(api.getJwtToken(), null);
  });
}

test('verified admin session can access AdminView', async () => {
  api.setJwtToken('admin-token');
  fetch = async () => response({ user: admin });
  const harness = componentHarness('../src/App.tsx', 'default');
  harness.render();
  harness.flushEffects();
  await tick();
  find(harness.render(), (node) => node.type?.displayName === 'Header').props.onToggleAdminMode();
  assert.ok(find(harness.render(), (node) => node.type?.displayName === 'AdminView'));
});

test('Google sign-in is disabled and has no authenticated callback', () => {
  const { harness, loggedIn } = loginHarness();
  const button = find(harness.render(), (node) => node.props?.id === 'gmail-login-btn');
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.onClick, undefined);
  assert.equal(loggedIn.length, 0);
});

test('older token verification cannot remove a newer login token', async () => {
  api.setJwtToken('old-token');
  let resolve;
  fetch = () => new Promise((done) => { resolve = done; });
  const verification = api.apiFetchCurrentUser();
  api.setJwtToken('new-token');
  resolve(response({}, 401));
  assert.equal(await verification, null);
    assert.equal(api.getJwtToken(), 'new-token');
});

test('pending startup verification cannot overwrite a successful login', async () => {
  api.setJwtToken('old-token');
  let resolve;
  fetch = () => new Promise((done) => { resolve = done; });
  const harness = componentHarness('../src/App.tsx', 'default');
  harness.render();
  harness.flushEffects();
  const modal = find(harness.render(), (node) => node.type?.displayName === 'AuthModal');
  api.setJwtToken('new-token');
  modal.props.onLogin({ ...admin, id: String(admin.id) });
  resolve(response({}, 401));
  await tick();
  assert.equal(find(harness.render(), (node) => node.type?.displayName === 'Header').props.user.role, 'admin');
});

test('profile admin controls ignore email, ID format, and old admin flags', () => {
  const harness = componentHarness('../src/components/AuthModal.tsx', 'AuthModal', {
    isOpen: true, user: { ...traveler, id: 'admin-local' }, isAdmin: true,
    onClose() {}, onLogout() {}, onLogin() {}, onNavigateAdmin() {},
  });
  assert.equal(find(harness.render(), (node) => node.props?.id === 'profile-open-cms-btn'), undefined);
});

for (const [label, user] of [['admin', admin], ['traveler', traveler]]) {
  test(`${label} logout revokes the captured token, leaves Admin, and survives refresh`, async () => {
    api.setJwtToken('active-token');
    localStorage.setItem('sf_saved_sites', '["42"]');
    const calls = [];
    fetch = async (url, options) => {
      calls.push([url, options]);
      return url.endsWith('/auth/logout')
        ? response({ message: 'Logged out successfully' }) : response({ user });
    };
    const harness = componentHarness('../src/App.tsx', 'default');
    harness.render();
    harness.flushEffects();
    await tick();
    let tree = harness.render();
    harness.flushEffects();
    assert.ok(localStorage.getItem('sf_user_profile'));
    if (label === 'admin') {
      find(tree, (node) => node.type?.displayName === 'Header').props.onToggleAdminMode();
      tree = harness.render();
      find(tree, (node) => node.type?.displayName === 'AdminView').props.onLogout();
    } else {
      find(tree, (node) => node.type?.displayName === 'AuthModal').props.onLogout();
    }
    tree = harness.render();
    assert.equal(api.getJwtToken(), null);
    assert.equal(localStorage.getItem('sf_user_profile'), null);
    assert.equal(localStorage.getItem('sf_saved_sites'), '["42"]');
    assert.equal(find(tree, (node) => node.type?.displayName === 'Header').props.user, null);
    assert.equal(find(tree, (node) => node.type?.displayName === 'Header').props.currentView, 'home');
    assert.equal(find(tree, (node) => node.type?.displayName === 'AdminView'), undefined);
    const logoutCall = calls.find(([url]) => url.endsWith('/auth/logout'));
    assert.equal(logoutCall[1].method, 'POST');
    assert.equal(logoutCall[1].headers.Authorization, 'Bearer active-token');
    const refreshed = componentHarness('../src/App.tsx', 'default');
    refreshed.render();
    refreshed.flushEffects();
    await tick();
    assert.equal(find(refreshed.render(), (node) => node.type?.displayName === 'Header').props.user, null);
    assert.equal(calls.filter(([url]) => url.endsWith('/auth/me')).length, 1);
  });
}

for (const outcome of ['network', 'server-error', 'invalid-token', 'timeout']) {
  test(`local logout completes on ${outcome}`, async (context) => {
    api.setJwtToken('active-token');
    localStorage.setItem('sf_user_profile', JSON.stringify(admin));
    if (outcome === 'timeout') {
      context.mock.method(AbortSignal, 'timeout', (duration) => {
        assert.equal(duration, 5000);
        return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'));
      });
    }
    fetch = async (_, options) => {
      if (outcome === 'network') throw new Error('Offline');
      if (outcome === 'timeout') options.signal.throwIfAborted();
      return response({}, outcome === 'invalid-token' ? 401 : 500);
    };
    await api.apiLogout();
    assert.equal(api.getJwtToken(), null);
    assert.equal(localStorage.getItem('sf_user_profile'), null);
  });
}

test('logout without a token still removes the cached profile', async () => {
  localStorage.setItem('sf_user_profile', JSON.stringify(admin));
  let calls = 0;
  fetch = async () => { calls++; throw new Error('Should not call server'); };
  await api.apiLogout();
  assert.equal(localStorage.getItem('sf_user_profile'), null);
  assert.equal(calls, 0);
});

test('late current-user responses cannot restore a logged-out session', async () => {
  api.setJwtToken('active-token');
  let resolve;
  fetch = (url) => url.endsWith('/auth/me')
    ? new Promise((done) => { resolve = done; }) : Promise.resolve(response({}));
  const verification = api.apiFetchCurrentUser();
  await api.apiLogout();
  resolve(response({ user: admin }));
  assert.equal(await verification, null);
  assert.equal(api.getJwtToken(), null);
});

test('logout invalidates an already-started React session verification', async () => {
  api.setJwtToken('active-token');
  let resolve;
  fetch = async () => response({});
  const harness = componentHarness('../src/App.tsx', 'default', {}, {
    apiFetchCurrentUser: () => new Promise((done) => { resolve = done; }),
  });
  harness.render();
  harness.flushEffects();
  let tree = harness.render();
  const modal = find(tree, (node) => node.type?.displayName === 'AuthModal');
  modal.props.onLogin({ ...admin, id: String(admin.id) });
  modal.props.onLogout();
  // Deliberately bypass the API guard to exercise App's own revision guard.
  resolve({ ...admin, id: String(admin.id) });
  await tick();
  tree = harness.render();
  assert.equal(find(tree, (node) => node.type?.displayName === 'Header').props.user, null);
});

test('pending login responses cannot save a token after logout', async () => {
  let resolve;
  fetch = (url) => url.endsWith('/auth/login')
    ? new Promise((done) => { resolve = done; }) : Promise.resolve(response({}));
  const login = api.apiLogin(admin.email, 'password');
  await api.apiLogout();
  resolve(response({ access_token: 'late-token', user: admin }));
  await assert.rejects(login, /Sign-in cancelled/);
  assert.equal(api.getJwtToken(), null);
});

test('a previous logout request cannot clear a newer login', async () => {
  api.setJwtToken('old-token');
  let resolve;
  fetch = () => new Promise((done) => { resolve = done; });
  const logout = api.apiLogout();
  api.setJwtToken('new-token');
  localStorage.setItem('sf_user_profile', JSON.stringify(traveler));
  resolve(response({}));
  await logout;
  assert.equal(api.getJwtToken(), 'new-token');
  assert.equal(JSON.parse(localStorage.getItem('sf_user_profile')).role, 'traveler');
});

test('registration and Google login store the same JWT response in one location', async () => {
  const requests = [];
  fetch = async (url, options) => {
    requests.push(url);
    assert.equal(options.headers.Authorization, undefined);
    return response({ access_token: 'jwt-access', token_type: 'bearer', expires_in: 3600, user: traveler });
  };
  assert.equal((await api.apiRegister('Visitor', traveler.email, 'password')).token, 'jwt-access');
  assert.equal((await api.apiGoogleLogin('google-credential')).token, 'jwt-access');
  assert.deepEqual(requests, ['/api/auth/register', '/api/auth/google']);
  assert.equal(localStorage.getItem('chis_jwt_token'), 'jwt-access');
  assert.equal(localStorage.getItem('sf_user_profile'), null);
});

test('expired current-user JWT refreshes once and verifies with the replacement', async () => {
  api.setJwtToken('expired-jwt');
  const requests = [];
  fetch = async (url, options) => {
    requests.push([url, new Headers(options.headers).get('Authorization')]);
    if (url === '/api/auth/refresh') return response({ access_token: 'new-jwt' });
    return new Headers(options.headers).get('Authorization') === 'Bearer expired-jwt' ? response({}, 401) : response({ user: traveler });
  };
  assert.equal((await api.apiFetchCurrentUser()).id, String(traveler.id));
  assert.equal(api.getJwtToken(), 'new-jwt');
  assert.deepEqual(requests, [['/api/auth/me', 'Bearer expired-jwt'], ['/api/auth/refresh', 'Bearer expired-jwt'], ['/api/auth/me', 'Bearer new-jwt']]);
});

test('concurrent protected requests share one refresh and retry at most once', async () => {
  api.setJwtToken('expired-jwt');
  let refreshes = 0;
  let resolveRefresh;
  const refresh = new Promise(resolve => { resolveRefresh = resolve; });
  fetch = async (url, options) => {
    if (url === '/api/auth/refresh') { refreshes++; return refresh; }
    if (new Headers(options.headers).get('Authorization') === 'Bearer expired-jwt') return response({}, 401);
    if (url === '/api/auth/me') return response({ user: traveler });
    return response({ total_points: 0, visited_count: 0, eligible_site_count: 0, visited_eligible_count: 0, visits: [], eligible_sites: [] });
  };
  const current = api.apiFetchCurrentUser();
  const passport = api.apiFetchPassport();
  await tick();
  resolveRefresh(response({ access_token: 'new-jwt' }));
  assert.equal((await current).id, String(traveler.id));
  assert.equal((await passport).total_points, 0);
  assert.equal(refreshes, 1);
});

test('late 401 from the previous JWT uses the completed rotation without refreshing again', async () => {
  api.setJwtToken('expired-jwt');
  let resolvePassport;
  let refreshes = 0;
  const delayed = new Promise(resolve => { resolvePassport = resolve; });
  fetch = async (url, options) => {
    if (url === '/api/auth/refresh') { refreshes++; return response({ access_token: 'new-jwt' }); }
    if (new Headers(options.headers).get('Authorization') === 'Bearer expired-jwt') return url === '/api/passport' ? delayed : response({}, 401);
    if (url === '/api/auth/me') return response({ user: traveler });
    return response({ total_points: 0, visited_count: 0, eligible_site_count: 0, visited_eligible_count: 0, visits: [], eligible_sites: [] });
  };
  const passport = api.apiFetchPassport();
  await api.apiFetchCurrentUser();
  resolvePassport(response({}, 401));
  await passport;
  assert.equal(refreshes, 1);
});

for (const failure of ['refresh-rejected', 'retry-rejected', 'network', 'malformed']) {
  test(`JWT ${failure} clears state without retry loops`, async () => {
    api.setJwtToken('expired-jwt');
    localStorage.setItem('sf_user_profile', JSON.stringify(admin));
    let refreshes = 0;
    let protectedRequests = 0;
    fetch = async url => {
      if (url === '/api/auth/refresh') {
        refreshes++;
        if (failure === 'network') throw new Error('Offline');
        if (failure === 'malformed') return response({});
        return response({ access_token: 'new-jwt' }, failure === 'refresh-rejected' ? 401 : 200);
      }
      protectedRequests++;
      return response({}, 401);
    };
    assert.equal(await api.apiFetchCurrentUser(), null);
    assert.equal(refreshes, 1);
    assert.equal(protectedRequests, failure === 'retry-rejected' ? 2 : 1);
    assert.equal(api.getJwtToken(), null);
    assert.equal(localStorage.getItem('sf_user_profile'), null);
  });
}

test('logout during token rotation cannot resurrect the session', async () => {
  api.setJwtToken('expired-jwt');
  let resolveRefresh;
  fetch = async url => url === '/api/auth/refresh'
    ? new Promise(resolve => { resolveRefresh = resolve; }) : response({}, url === '/api/auth/logout' ? 200 : 401);
  const pending = api.apiFetchCurrentUser();
  await tick();
  await api.apiLogout();
  resolveRefresh(response({ access_token: 'late-jwt' }));
  assert.equal(await pending, null);
  assert.equal(api.getJwtToken(), null);
});

test('public reads never attach JWT or initiate refresh', async () => {
  api.setJwtToken('jwt-access');
  fetch = async (url, options) => {
    assert.equal(url, '/api/events');
    assert.equal(new Headers(options.headers).has('Authorization'), false);
    return response([]);
  };
  await api.apiFetchEvents();
});

test('a role denial never rotates or clears a valid visitor JWT', async () => {
  api.setJwtToken('visitor-jwt');
  let requests = 0;
  fetch = async url => {
    requests++;
    assert.equal(url, '/api/admin/travelers');
    return response({}, 403);
  };
  await assert.rejects(api.apiFetchTravelers(), error => error.status === 403);
  assert.equal(requests, 1);
  assert.equal(api.getJwtToken(), 'visitor-jwt');
});

test('cross-tab token replacement cannot return the previous account profile', async () => {
  api.setJwtToken('old-account-jwt');
  let resolve;
  fetch = async () => new Promise(done => { resolve = done; });
  const current = api.apiFetchCurrentUser();
  localStorage.setItem('chis_jwt_token', 'other-account-jwt');
  resolve(response({ user: admin }));
  assert.equal(await current, null);
  assert.equal(api.getJwtToken(), 'other-account-jwt');
});
