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
const coordinateModuleUrl = `data:text/javascript;base64,${Buffer.from(compile(read('../src/utils/heritageCoordinates.ts'), ts.ModuleKind.ESNext)).toString('base64')}`;
const osrm = await import(`data:text/javascript;base64,${Buffer.from(compile(read('../src/utils/osrm.ts').replace("'./heritageCoordinates'", JSON.stringify(coordinateModuleUrl)), ts.ModuleKind.ESNext)).toString('base64')}`);
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
const experienceProps = { site: { id: '1', name: 'Heritage site', visitVerificationEnabled: true }, user: visitor, onLogin() {} };
const contributionRow = { id: 4, visitor_name: 'Recorded visitor', caption: 'A memorable visit <safe text>', created_at: '2026-10-09T12:00:00Z', images: ['/storage/visitor-contributions/test.png'] };
const contributionEligibility = (status = null, verified = true, active = true) => ({ verified, active, can_submit: verified && active && (!status || status === 'rejected'), contribution: status ? { id: 4, status } : null });

test('Visitor Experiences loads approved photos and plain caption with no private visitor fields', async () => {
  fetch = async () => reply([contributionRow]);
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', { ...experienceProps, user: null });
  assert.ok(allText(view.render()).includes('Loading visitor experiences')); view.flush(); await tick();
  const tree = view.render();
  assert.ok(allText(tree).includes('Recorded visitor') && allText(tree).includes(contributionRow.caption));
  assert.equal(find(tree, node => node.type === 'img').props.alt, 'Visitor photo from Heritage site');
  assert.equal(find(tree, node => node.props?.dangerouslySetInnerHTML), undefined);
  assert.equal(allText(tree).includes(visitor.email), false);
});

test('Visitor Experiences empty state and guest Sign In action', async () => {
  fetch = async () => reply([]); let logins = 0;
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', { ...experienceProps, user: null, onLogin() { logins++; } });
  view.render(); view.flush(); await tick();
  const tree = view.render();
  assert.ok(allText(tree).includes('No visitor experiences have been shared yet.') && allText(tree).includes('Sign in to share your experience.'));
  find(tree, node => node.type === 'button' && allText(node) === 'Sign In').props.onClick(); assert.equal(logins, 1);
});

test('Visitor Experiences network error offers Retry and recovers', async () => {
  fetch = async () => { throw new Error('private failure'); };
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', { ...experienceProps, user: null });
  view.render(); view.flush(); await tick();
  assert.ok(find(view.render(), node => node.props?.role === 'alert')); assert.equal(allText(view.render()).includes('private failure'), false);
  fetch = async () => reply([contributionRow]);
  find(view.render(), node => node.type === 'button' && allText(node) === 'Retry').props.onClick(); view.render(); view.flush(); await tick();
  assert.ok(allText(view.render()).includes(contributionRow.visitor_name));
});

test('unverified user is linked to existing Verify My Visit flow and refreshes after verification', async () => {
  let verified = false, focused = 0;
  fetch = async url => reply(url.endsWith('/mine') ? contributionEligibility(null, verified) : []);
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', { ...experienceProps, onVerifyVisit() { focused++; return true; } });
  view.render(); view.flush(); await tick();
  assert.ok(allText(view.render()).includes('Verify your visit before sharing an experience.'));
  assert.equal(find(view.render(), node => node.type === 'form'), undefined);
  find(view.render(), node => node.type === 'button' && allText(node) === 'Verify My Visit').props.onClick(); assert.equal(focused, 1);
  verified = true; view.render({ ...experienceProps, verificationRevision: 1 }); view.flush(); await tick();
  assert.ok(find(view.render(), node => node.props?.id === 'contribution-form'));
  const detail = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { ...experienceProps, site: { ...experienceProps.site, heroImage: '' }, onBack() {}, onToggleSave() {} });
  const verification = find(detail.render(), node => node.type?.displayName === 'VisitVerification');
  verification.props.onVerified();
  assert.equal(find(detail.render(), node => node.type?.displayName === 'VisitorExperiences').props.verificationRevision, 1);
});

test('verified form previews images, removes selection, validates count/type/size and does not upload on selection', async () => {
  let uploads = 0;
  fetch = async (url, options = {}) => { if (options.method === 'POST') uploads++; return reply(url.endsWith('/mine') ? contributionEligibility() : []); };
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', experienceProps);
  view.render(); view.flush(); await tick();
  const file = new File(['png'], 'photo.png', { type: 'image/png' });
  const select = selected => find(view.render(), node => node.props?.id === 'contribution-photos').props.onChange({ target: { files: selected } });
  select([file, file]); view.render(); view.flush();
  assert.ok(visibleText(view.render()).includes('2 of 3 photos selected'));
  assert.ok(find(view.render(), node => node.type === 'img').props.src.startsWith('blob:'));
  find(view.render(), node => node.type === 'button' && visibleText(node) === 'Remove photo 1').props.onClick(); view.render(); view.flush();
  assert.ok(visibleText(view.render()).includes('1 of 3 photos selected'));
  select([file, file, file, file]); assert.ok(allText(view.render()).includes('maximum of 3'));
  for (const invalid of [new File(['svg'], 'test.svg', { type: 'image/svg+xml' }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })]) {
    select([invalid]); assert.ok(find(view.render(), node => node.props?.role === 'alert')); assert.ok(allText(view.render()).includes('no larger than 5 MB'));
  }
  assert.equal(uploads, 0); view.unmount();
});

test('contribution upload uses multipart auth, prevents double submit and transitions to pending', async () => {
  localStorage.setItem('chis_jwt_token', 'visitor-token'); let finish; const requests = [];
  fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    if (options.method === 'POST') return new Promise(resolve => { finish = resolve; });
    return reply(url.endsWith('/mine') ? contributionEligibility() : []);
  };
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', experienceProps);
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.props?.id === 'contribution-photos').props.onChange({ target: { files: [new File(['png'], 'photo.png', { type: 'image/png' })] } }); view.render(); view.flush();
  find(view.render(), node => node.props?.id === 'contribution-caption').props.onChange({ target: { value: 'Our visit' } });
  const form = find(view.render(), node => node.props?.id === 'contribution-form');
  form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} });
  const posts = requests.filter(request => request.method === 'POST'); assert.equal(posts.length, 1);
  assert.equal(posts[0].headers.Authorization, 'Bearer visitor-token'); assert.equal(posts[0].headers['Content-Type'], undefined);
  assert.equal(posts[0].body.getAll('images[]').length, 1); assert.equal(posts[0].body.get('caption'), 'Our visit'); assert.equal(posts[0].body.has('heritage_site_id'), false);
  assert.equal(find(view.render(), node => node.type === 'button' && allText(node) === 'Submitting…').props.disabled, true);
  finish(reply({ id: 4, status: 'pending' }, 201)); await tick();
  assert.ok(allText(view.render()).includes('Your contribution is awaiting review.'));
  assert.equal(find(view.render(), node => node.type === 'form'), undefined); view.render(); view.flush(); view.unmount();
});

for (const status of ['pending', 'approved', 'rejected']) test(`contribution ${status} status uses backend state and only rejected allows replacement`, async () => {
  fetch = async url => reply(url.endsWith('/mine') ? contributionEligibility(status) : []);
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', experienceProps);
  view.render(); view.flush(); await tick();
  assert.ok(allText(view.render()).includes(status === 'pending' ? 'awaiting review' : status === 'approved' ? 'published' : 'rejected'));
  assert.equal(Boolean(find(view.render(), node => node.type === 'form')), status === 'rejected');
});

test('Admin contribution filters, approve, reject, remove and locks moderation while saving', async () => {
  const requests = []; let status = 'pending', complete;
  fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    if (options.method === 'PATCH') return new Promise(resolve => { complete = () => { status = JSON.parse(options.body).status; resolve(reply({ id: 4, status })); }; });
    if (options.method === 'DELETE') return reply({}, 204);
    return reply(url.endsWith(`status=${status}`) ? [{ ...contributionRow, status, heritage_site: { id: 1, name: 'Official landmark', status: 'active' } }] : []);
  };
  const view = harness('../src/components/AdminContributions.tsx', 'AdminContributions', {}, { __window: { confirm: () => true } });
  assert.ok(allText(view.render()).includes('Loading contributions')); view.flush(); await tick();
  assert.ok(allText(view.render()).includes('Official landmark') && allText(view.render()).includes('Recorded visitor'));
  const approve = find(view.render(), node => node.type === 'button' && allText(node) === 'Approve'); approve.props.onClick(); approve.props.onClick();
  assert.equal(requests.filter(request => request.method === 'PATCH').length, 1);
  assert.equal(find(view.render(), node => node.type === 'button' && allText(node) === 'Reject').props.disabled, true);
  complete(); await tick(); view.render(); view.flush(); await tick();
  find(view.render(), node => node.type === 'button' && allText(node) === 'Approved').props.onClick(); view.render(); view.flush(); await tick();
  find(view.render(), node => node.type === 'button' && allText(node) === 'Reject').props.onClick(); complete(); await tick(); view.render(); view.flush(); await tick();
  find(view.render(), node => node.type === 'button' && allText(node) === 'Rejected').props.onClick(); view.render(); view.flush(); await tick();
  find(view.render(), node => node.type === 'button' && allText(node) === 'Remove').props.onClick(); await tick();
  assert.ok(requests.some(request => request.method === 'DELETE'));
});

test('Admin contribution network errors recover through Retry and empty pending state', async () => {
  fetch = async () => { throw new Error('private'); };
  const view = harness('../src/components/AdminContributions.tsx', 'AdminContributions');
  view.render(); view.flush(); await tick(); assert.ok(find(view.render(), node => node.props?.role === 'alert'));
  fetch = async () => reply([]);
  find(view.render(), node => node.type === 'button' && allText(node) === 'Retry').props.onClick(); view.render(); view.flush(); await tick();
  assert.ok(allText(view.render()).includes('No contributions waiting for review.'));
});

test('contribution API safely handles unauthorized, not verified, conflict, rate limits, validation, server and malformed responses', async () => {
  for (const [status, pattern] of [[401, /sign in/i], [403, /Verify your visit/], [409, /already exists|archived/], [413, /too large/], [422, /correct the form/], [429, /Too many/], [500, /temporarily unavailable/]]) {
    fetch = async () => reply({ message: 'SQLSTATE private backend exception' }, status);
    await assert.rejects(api.apiSubmitContribution('1', [], ''), error => pattern.test(error.message) && !/SQLSTATE|private/.test(error.message));
  }
  fetch = async () => reply({}); await assert.rejects(api.apiSubmitContribution('1', [], ''), /Reload your contribution status/);
  await assert.rejects(api.apiFetchMyContribution('1'), /Unable to load your contribution status/);
  fetch = async () => reply([{}]); await assert.rejects(api.apiFetchAdminContributions('pending'), /Unable to load contributions/);
});

test('submission validation error preserves photos and caption and allows a successful retry', async () => {
  let invalid = true;
  fetch = async (url, options = {}) => options.method === 'POST'
    ? reply(invalid ? { errors: { caption: ['The caption must be plain text without HTML.'] } } : { id: 4, status: 'pending' }, invalid ? 422 : 201)
    : reply(url.endsWith('/mine') ? contributionEligibility() : []);
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', experienceProps);
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.props?.id === 'contribution-photos').props.onChange({ target: { files: [new File(['png'], 'photo.png', { type: 'image/png' })] } }); view.render(); view.flush();
  find(view.render(), node => node.props?.id === 'contribution-caption').props.onChange({ target: { value: '<b>visit</b>' } });
  await find(view.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.ok(allText(view.render()).includes('plain text without HTML')); assert.ok(find(view.render(), node => node.props?.role === 'alert'));
  assert.equal(find(view.render(), node => node.props?.id === 'contribution-caption').props.value, '<b>visit</b>');
  assert.ok(visibleText(view.render()).includes('1 of 3 photos selected'));
  invalid = false;
  find(view.render(), node => node.props?.id === 'contribution-caption').props.onChange({ target: { value: 'visit' } });
  await find(view.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.ok(allText(view.render()).includes('awaiting review')); view.render(); view.flush(); view.unmount();
});
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
  assert.equal(find(view.render(), node => node.props?.id === 'verify-location').props.disabled, false);
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
    else {
      assert.equal(refreshed, 0); assert.ok(text.includes(state === 'outside' ? 'outside' : 'accuracy is weak'));
      assert.equal(find(view.render(), node => node.props?.id === 'verify-location').props.disabled, false);
      find(view.render(), node => node.props?.id === 'verify-location').props.onClick();
      assert.equal(find(view.render(), node => node.props?.id === 'verify-location').props.disabled, true);
    }
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
  assert.ok(text.includes('200 Points') && text.includes('2 verified sites') && text.includes('1 of 2') && text.includes('Not yet visited') && text.includes('Currently unavailable'));
  assert.ok(text.includes('PASAPORTE NG PAMANA') && text.includes('50% unlocked'));
  assert.equal(find(tree, node => node.props?.['data-unlocked'] === true).props.className.includes('border-[#c6931d]'), true);
  assert.equal(/QR|Scan Plaque|First Discovery|History Explorer/.test(text), false);
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
  const config = { id: 1, heritage_site_id: 1, name: 'Official site', category: 'Churches', address: 'Address', status: 'active', has_coordinates: true, enabled: true, radius_meters: 100, verified_visitors: 2 };
  let saved;
  const modules = { '../api/client': { apiFetchCheckinConfigs: async () => [config], apiSaveCheckinConfig: async (id, enabled, radius) => { saved = [id, enabled, radius]; return { ...config, enabled, radius_meters: radius }; } } };
  const view = harness('../src/components/AdminCheckins.tsx', 'AdminCheckins', {}, modules);
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.props?.id === 'checkin-radius-1').props.onChange({ target: { value: '75' } });
  find(view.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await tick();
  assert.deepEqual(saved, ['1', true, 75]);
  const text = visibleText(view.render()); assert.ok(text.includes('Visit Verification') && text.includes('2 verified visitors'));
  assert.equal(/QR|public_token|Rotate/.test(text), false);
});

const adminVerificationRows = [
  { id: 1, heritage_site_id: 1, name: 'Cathedral', category: 'Churches', address: 'Central Street', status: 'active', has_coordinates: true, enabled: true, radius_meters: 75, verified_visitors: 12 },
  { id: null, heritage_site_id: 2, name: 'Museum', category: 'Museums', address: 'Market Road', status: 'active', has_coordinates: true, enabled: false, radius_meters: 100, verified_visitors: 0 },
  { id: null, heritage_site_id: 3, name: 'Archived landmark', category: 'Monuments', address: 'Old Road', status: 'archived', has_coordinates: true, enabled: false, radius_meters: 100, verified_visitors: 0 },
  { id: null, heritage_site_id: 4, name: 'Missing location', category: 'Cultural Sites', address: 'North Road', status: 'active', has_coordinates: false, enabled: false, radius_meters: 100, verified_visitors: 0 },
];
const adminNode = (view, id) => find(view.render(), node => node.props?.id === id);
const adminManager = async (save = async () => {}, fetchRows = async () => adminVerificationRows) => {
  const view = harness('../src/components/AdminCheckins.tsx', 'AdminCheckins', {}, { '../api/client': { AdminApiError: api.AdminApiError, apiFetchCheckinConfigs: fetchRows, apiSaveCheckinConfig: save } });
  view.render(); view.flush(); await tick(); return view;
};
test('Admin verification lists all sites, defaults, restrictions and counts without site selection', async () => {
  const view = await adminManager();
  for (const row of adminVerificationRows) assert.ok(adminNode(view, `checkin-site-${row.heritage_site_id}`));
  assert.equal(adminNode(view, 'checkin-enabled-1').props['aria-checked'], true);
  assert.equal(adminNode(view, 'checkin-enabled-2').props['aria-checked'], false);
  for (const id of [3, 4]) assert.equal(adminNode(view, `checkin-enabled-${id}`).props.disabled, true);
  assert.equal(adminNode(view, 'checkin-radius-1').props.value, '75');
  assert.equal(adminNode(view, 'checkin-radius-2').props.value, '100');
  assert.ok(visibleText(view.render()).includes('12 verified visitors'));
  assert.ok(visibleText(view.render()).includes('Archived sites cannot use visit verification.'));
  assert.ok(visibleText(view.render()).includes('Coordinates required before Visit Verification can be enabled.'));
  assert.equal(adminNode(view, 'checkin-admin-site'), undefined);
  for (const row of adminVerificationRows) assert.equal(adminNode(view, `checkin-save-${row.heritage_site_id}`).props.disabled, true);
});
test('Admin missing-coordinate action opens existing Heritage management', async () => {
  let opened = 0;
  const view = harness('../src/components/AdminCheckins.tsx', 'AdminCheckins', { onManageHeritage: () => opened++ }, { '../api/client': { apiFetchCheckinConfigs: async () => adminVerificationRows } });
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.type === 'button' && visibleText(node) === 'Edit Heritage Site').props.onClick();
  assert.equal(opened, 1);
});
test('Admin verification saves only changed row, prevents double save and leaves other rows usable', async () => {
  let finish, loads = 0; const saves = [];
  const view = await adminManager((id, enabled, radius) => { saves.push([id, enabled, radius]); return new Promise(resolve => { finish = () => resolve({ ...adminVerificationRows[1], id: 2, enabled, radius_meters: radius }); }); }, async () => { loads++; return adminVerificationRows; });
  adminNode(view, 'checkin-enabled-2').props.onClick();
  assert.equal(adminNode(view, 'checkin-save-2').props.disabled, false);
  const form = adminNode(view, 'checkin-site-2'); form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} });
  assert.equal(saves.length, 1); assert.deepEqual(saves[0], ['2', true, 100]);
  assert.equal(adminNode(view, 'checkin-enabled-2').props.disabled, true);
  assert.equal(Boolean(adminNode(view, 'checkin-enabled-1').props.disabled), false);
  adminNode(view, 'checkin-radius-1').props.onChange({ target: { value: '90' } });
  assert.equal(Boolean(adminNode(view, 'checkin-save-1').props.disabled), false);
  finish(); await tick();
  assert.equal(adminNode(view, 'checkin-save-2').props.disabled, true);
  assert.ok(visibleText(view.render()).includes('Visit verification updated.'));
  assert.equal(loads, 1);
});
test('Admin verification radius validates, disable saves, failed save retains changes for retry', async () => {
  const calls = []; let fail = true;
  const view = await adminManager(async (id, enabled, radius) => { calls.push([id, enabled, radius]); if (fail) throw new Error('private server details'); return { ...adminVerificationRows[0], enabled, radius_meters: radius }; });
  for (const value of ['', '24', '501', '50.5']) {
    adminNode(view, 'checkin-radius-1').props.onChange({ target: { value } });
    adminNode(view, 'checkin-site-1').props.onSubmit({ preventDefault() {} }); await tick();
    assert.ok(visibleText(view.render()).includes('whole number between 25 and 500'));
  }
  assert.equal(calls.length, 0);
  adminNode(view, 'checkin-radius-1').props.onChange({ target: { value: '500' } }); adminNode(view, 'checkin-enabled-1').props.onClick();
  adminNode(view, 'checkin-site-1').props.onSubmit({ preventDefault() {} }); await tick();
  assert.ok(visibleText(view.render()).includes('Unable to save'));
  assert.equal(visibleText(view.render()).includes('private server details'), false);
  assert.equal(Boolean(adminNode(view, 'checkin-save-1').props.disabled), false);
  fail = false; adminNode(view, 'checkin-site-1').props.onSubmit({ preventDefault() {} }); await tick();
  assert.deepEqual(calls[1], ['1', false, 500]);
  assert.equal(adminNode(view, 'checkin-enabled-1').props['aria-checked'], false);
});
test('Admin verification search, compact filters and empty search result work', async () => {
  const view = await adminManager();
  for (const query of ['cathedral', 'museums', 'market road']) {
    adminNode(view, 'checkin-search').props.onChange({ target: { value: query } });
    assert.ok(adminNode(view, query === 'cathedral' ? 'checkin-site-1' : 'checkin-site-2'));
  }
  adminNode(view, 'checkin-search').props.onChange({ target: { value: '' } });
  for (const [label, ids] of [['Enabled', [1]], ['Disabled', [2, 3, 4]], ['Missing Coordinates', [4]], ['Archived', [3]], ['All', [1, 2, 3, 4]]]) {
    find(view.render(), node => node.type === 'button' && visibleText(node) === label).props.onClick();
    for (const row of adminVerificationRows) assert.equal(Boolean(adminNode(view, `checkin-site-${row.heritage_site_id}`)), ids.includes(row.heritage_site_id));
  }
  adminNode(view, 'checkin-search').props.onChange({ target: { value: 'no match' } });
  assert.ok(visibleText(view.render()).includes('No heritage sites match your search.'));
});
test('Admin verification loading failure retries without exposing raw exceptions', async () => {
  let fail = true;
  const view = await adminManager(undefined, async () => { if (fail) throw new api.AdminApiError('Unable to load visit verification configuration.'); return adminVerificationRows; });
  const retry = find(view.render(), node => node.type === 'button' && /Retry|Try again/i.test(visibleText(node)));
  assert.ok(retry); fail = false; retry.props.onClick(); view.render(); view.flush(); await tick();
  assert.ok(adminNode(view, 'checkin-site-1'));
});

beforeEach(() => {
  osrm.clearRoadRouteCache();
  api.clearItineraryCache();
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
    lazy(loader) {
      const name = /module\.(\w+)/.exec(String(loader))?.[1] || 'LazyView';
      return Object.assign(() => null, { displayName: name });
    },
    Suspense: Object.assign(() => null, { displayName: 'Suspense' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(callback) { cursor++; return callback(); },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { callback, deps };
      return slots[index].callback;
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
  const exports = {}, stubs = new Map();
  vm.runInNewContext(compile(read(path)), {
    exports, console, Error, localStorage, sessionStorage, setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
    window: modules.__window || { scrollTo() {} }, navigator: modules.__navigator || {}, URL, document: modules.__document || {},
    require(name) {
      if (name === imageModuleUrl) return imageHelpers;
      if (name.endsWith('/utils/osrm')) return modules[name] || osrm;
      if (name.endsWith('/data/heritageChatEngine')) return chatEngine;
      if (name.endsWith('/utils/heritageNavigation')) return navigation;
      if (name === 'react') return hooks;
      if (name.endsWith('/ErrorState')) return { ErrorState: props => harness('../src/components/ErrorState.tsx', 'ErrorState', props).render() };
      if (name === 'react/jsx-runtime') {
        const runtime = require(name);
        return { ...runtime, jsx: (type, props, key) => type?.name === 'ErrorState' ? type(props) : runtime.jsx(type, props, key), jsxs: (type, props, key) => type?.name === 'ErrorState' ? type(props) : runtime.jsxs(type, props, key) };
      }
      if (modules[name]) return modules[name];
      if (name.endsWith('/utils/loadLeaflet')) return { loadLeaflet: async () => modules.leaflet || mapRuntime().leaflet };
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
  test(`explicit Admin refresh clears catalogue on ${failure ? 'failure with visible error' : 'successful empty response'}`, async () => {
    const site = await mappedSite();
    let calls = 0;
    const view = harness('../src/App.tsx', 'default', {}, {
      './api/client': { ...api, apiFetchCurrentUser: async () => ({ ...visitor, role: 'admin' }), apiFetchPassport: async () => null, apiFetchEvents: async () => [],
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
    find(tree, node => node.type?.displayName === 'Header').props.onNavigate('admin');
    find(view.render(), node => node.type?.displayName === 'AdminView').props.onPublicDataChanged('heritage');
    view.render(); view.flush(); await tick();
    find(view.render(), node => node.type?.displayName === 'AdminView').props.onLogout();
    tree = view.render();
    assert.equal(find(tree, node => node.type?.displayName === 'HomeView').props.featuredSites.length, 0);
    if (failure) assert.ok(find(tree, node => node.props?.role === 'alert'));
  });
}

async function settleMap(view) {
  view.render(); view.flush(); await tick();
  const tree = view.render(); view.flush(); await tick();
  return tree;
}

test('startup catalogue, events and session are each requested once across Home/Explore/Map/Events navigation', async () => {
  const counts = { sites: 0, events: 0, auth: 0, passport: 0 };
  const browser = browserAt('#/home'), site = await mappedSite();
  const view = harness('../src/App.tsx', 'default', {}, { __window: browser, './api/client': { ...api,
    apiFetchSites: async () => { counts.sites++; return [site]; },
    apiFetchEvents: async () => { counts.events++; return []; },
    apiFetchCurrentUser: async () => { counts.auth++; return visitor; },
    apiFetchPassport: async () => { counts.passport++; return { visits: [], eligible_sites: [] }; },
  } });
  view.render(); view.flush(); await tick(); view.render(); view.flush(); await tick();
  for (const page of ['explore', 'map', 'events', 'home', 'plan']) {
    find(view.render(), node => node.type?.displayName === 'Header').props.onNavigate(page);
    view.render(); view.flush(); await tick();
  }
  assert.deepEqual(counts, { sites: 1, events: 1, auth: 1, passport: 0 });
  assert.equal(localStorage.getItem('sf_heritage_sites'), null);
});

test('startup events and session resolve independently of a slow heritage request; guest Passport is never requested', async () => {
  let finishHeritage, eventCalls = 0, sessionCalls = 0, passports = 0;
  const browser = browserAt('#/events');
  const view = harness('../src/App.tsx', 'default', {}, { __window: browser, './api/client': { ...api,
    apiFetchSites: () => new Promise(resolve => { finishHeritage = resolve; }),
    apiFetchEvents: async () => { eventCalls++; return [{ id: '1', title: 'Recorded event' }]; },
    apiFetchCurrentUser: async () => { sessionCalls++; return null; }, apiFetchPassport: async () => { passports++; },
  } });
  view.render(); view.flush(); await tick();
  const events = find(view.render(), node => node.type?.displayName === 'EventsView');
  assert.equal(events.props.events[0].title, 'Recorded event'); assert.equal(eventCalls, 1); assert.equal(sessionCalls, 1); assert.equal(passports, 0);
  finishHeritage([]); await tick(); view.unmount();
});

test('heritage remains usable while events and Passport are pending or fail', async () => {
  let failEvents, failPassport;
  const site = await mappedSite(), browser = browserAt('#/explore');
  const view = harness('../src/App.tsx', 'default', {}, { __window: browser, './api/client': { ...api,
    apiFetchSites: async () => [site], apiFetchEvents: () => new Promise((_, reject) => { failEvents = reject; }),
    apiFetchCurrentUser: async () => visitor, apiFetchPassport: () => new Promise((_, reject) => { failPassport = reject; }),
  } });
  view.render(); view.flush(); await tick(); view.render(); view.flush(); await tick();
  assert.equal(find(view.render(), node => node.type?.displayName === 'ExploreView').props.sites.length, 1);
  find(view.render(), node => node.type?.displayName === 'AuthModal').props.onOpenPassport();
  view.render(); view.flush(); await tick();
  failEvents(new Error('Unable to load events.')); failPassport(new Error('Unable to load Passport.')); await tick();
  assert.equal(find(view.render(), node => node.type?.displayName === 'ExploreView').props.sites.length, 1);
});

for (const resource of ['heritage', 'events']) test(`${resource} Retry reloads only the failed resource`, async () => {
  let siteCalls = 0, eventCalls = 0, fail = true;
  const browser = browserAt(resource === 'events' ? '#/events' : '#/explore');
  const view = harness('../src/App.tsx', 'default', {}, { __window: browser, './api/client': { ...api,
    apiFetchSites: async () => { siteCalls++; if (resource === 'heritage' && fail) throw new Error('Heritage unavailable'); return []; },
    apiFetchEvents: async () => { eventCalls++; if (resource === 'events' && fail) throw new Error('Events unavailable'); return []; }, apiFetchCurrentUser: async () => null,
  } });
  view.render(); view.flush(); await tick(); fail = false;
  find(view.render(), node => node.type === 'button' && visibleText(node) === 'Try Again').props.onClick(); view.render(); view.flush(); await tick();
  assert.equal(siteCalls, resource === 'heritage' ? 2 : 1); assert.equal(eventCalls, resource === 'events' ? 2 : 1);
  assert.equal(find(view.render(), node => node.props?.role === 'alert'), undefined);
});

test('session-expiry and cross-tab session events clear old auth independently of catalogue navigation', async () => {
  const browser = browserAt('#/home'); let checks = 0, currentUser = visitor;
  const view = harness('../src/App.tsx', 'default', {}, { __window: browser, './api/client': { ...api,
    apiFetchSites: async () => [], apiFetchEvents: async () => [], apiFetchCurrentUser: async () => { checks++; return currentUser; }, apiFetchPassport: async () => ({ visits: [], eligible_sites: [] }),
  } });
  view.render(); view.flush(); await tick(); view.render(); view.flush(); await tick();
  browser.emit('chis:session-expired');
  assert.equal(find(view.render(), node => node.type?.displayName === 'Header').props.user, null);
  assert.ok(find(view.render(), node => node.props?.role === 'alert'));
  currentUser = null; browser.emit('storage', { key: 'chis_jwt_token' }); view.render(); view.flush(); await tick();
  assert.equal(checks, 2);
});

test('lightweight catalogue maps one cover, short text and valid coordinates without pretending to be complete detail', async () => {
  fetch = async () => reply([{ ...rawSite, short_description: 'Recorded summary', description: undefined, history: undefined, cover_image: { id: 9, image_path: 'heritage-sites/cover.jpg', is_cover: true, sort_order: 8, caption: 'Cover' } }]);
  const [site] = await api.apiFetchSites();
  assert.equal(site.isSummary, true); assert.equal(site.shortDescription, 'Recorded summary'); assert.equal(site.fullDescription, ''); assert.equal(site.story, ''); assert.deepEqual(site.timeline, []);
  assert.equal(site.images.length, 1); assert.equal(site.heroImage, '/storage/heritage-sites/cover.jpg'); assert.deepEqual(site.coordinates, { lat: 15, lng: 120 });
});

test('search asks the summary endpoint only while open and preserves history matches through server search', async () => {
  const site = { ...await mappedSite(), isSummary: true, story: '' }; const requests = [];
  fetch = async url => { requests.push(url); return reply([{ ...rawSite, short_description: 'Summary', cover_image: null }]); };
  const props = { isOpen: false, sites: [site], events: [], onClose() {}, onSelectSite() {} };
  const view = harness('../src/components/SearchModal.tsx', 'SearchModal', props, { __window: browserAt() });
  view.render(); view.flush(); view.runTimers(); assert.equal(requests.length, 0);
  view.render({ ...props, isOpen: true }); view.flush();
  find(view.render({ ...props, isOpen: true }), node => node.props?.id === 'search-input-field').props.onChange({ target: { value: 'Recorded history' } });
  view.render({ ...props, isOpen: true }); view.flush(); view.runTimers(); await tick();
  assert.deepEqual(requests, ['/api/heritage-sites?search=Recorded%20history']);
  assert.ok(find(view.render({ ...props, isOpen: true }), node => node.props?.id === 'search-site-1'));
});

test('Leaflet loads only on map selection and a failed runtime load offers Retry', async () => {
  let calls = 0, fail = true; const runtime = mapRuntime();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [], savedSiteIds: [] }, { '../utils/loadLeaflet': { loadLeaflet: async () => { calls++; if (fail) throw new Error('private'); return runtime.leaflet; } } });
  await settleMap(view); assert.equal(calls, 0);
  find(view.render(), node => node.props?.id === 'toggle-map-view').props.onClick(); await settleMap(view);
  assert.equal(calls, 1); assert.ok(find(view.render(), node => node.props?.role === 'alert'));
  fail = false;
  find(view.render(), node => node.type === 'button' && visibleText(node) === 'Try Again').props.onClick(); await settleMap(view);
  assert.equal(calls, 2); assert.equal(runtime.options.length, 1);
});

test('App defers heavy views and contributions remain inside active Site Detail, not global startup', () => {
  const source = read('../src/App.tsx');
  for (const view of ['MapView', 'AdminView', 'SiteDetailView', 'PassportView', 'PlanView', 'EventsView']) assert.ok(source.includes(`const ${view} = lazy(`));
  assert.equal(source.includes('apiFetchContributions'), false); assert.ok(source.includes("if (currentView === 'plan') void apiFetchItineraries()"));
  assert.equal(read('../src/views/MapView.tsx').includes("import L from 'leaflet'"), false);
  assert.ok(read('../src/utils/leafletRuntime.ts').includes("import L from 'leaflet'"));
});

test('concurrent public and authenticated reads share transport without persisting errors or mixing sessions', async () => {
  let resolve, calls = 0;
  fetch = async () => { calls++; return new Promise(done => { resolve = done; }); };
  const first = api.apiFetchContributions('1'), replay = api.apiFetchContributions('1');
  assert.equal(calls, 1); resolve(reply([])); assert.deepEqual(await first, []); assert.deepEqual(await replay, []);
  const fresh = api.apiFetchContributions('1'); assert.equal(calls, 2); resolve(reply([])); await fresh;
  localStorage.setItem('chis_jwt_token', 'old'); const older = api.apiFetchMyContribution('1');
  const completeOld = resolve; localStorage.setItem('chis_jwt_token', 'new'); const newer = api.apiFetchMyContribution('1');
  assert.equal(calls, 4); completeOld(reply(contributionEligibility())); resolve(reply(contributionEligibility())); await Promise.all([older, newer]);
});

test('Visitor Experiences public content renders while authenticated eligibility is still pending', async () => {
  const pending = new Map();
  fetch = async url => new Promise(resolve => pending.set(url, resolve));
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', experienceProps);
  view.render(); view.flush();
  assert.deepEqual([...pending.keys()], ['/api/heritage-sites/1/contributions', '/api/heritage-sites/1/contributions/mine']);
  pending.get('/api/heritage-sites/1/contributions')(reply([contributionRow])); await tick();
  assert.ok(allText(view.render()).includes(contributionRow.visitor_name));
  assert.ok(allText(view.render()).includes('Loading your contribution status'));
  pending.get('/api/heritage-sites/1/contributions/mine')(reply(contributionEligibility())); await tick();
  assert.ok(find(view.render(), node => node.props?.id === 'contribution-form'));
});

test('successful verification refreshes App Passport without reloading the public catalogue or events', async () => {
  let passports = 0, catalogues = 0, events = 0;
  const site = await mappedSite(), browser = browserAt('#/heritage/1');
  const view = harness('../src/App.tsx', 'default', {}, { __window: browser, './api/client': { ...api,
    apiFetchCurrentUser: async () => visitor, apiFetchSites: async () => { catalogues++; return [site]; },
    apiFetchEvents: async () => { events++; return []; }, apiFetchSiteById: async () => site,
    apiFetchPassport: async () => { passports++; return { visits: [], eligible_sites: [] }; },
  } });
  view.render(); view.flush(); await tick(); view.render(); view.flush(); await tick();
  find(view.render(), node => node.type?.displayName === 'SiteDetailView').props.onVerified();
  view.render(); view.flush(); await tick();
  assert.equal(passports, 0);
  find(view.render(), node => node.type?.displayName === 'AuthModal').props.onOpenPassport();
  view.render(); view.flush(); await tick();
  assert.equal(passports, 1); assert.equal(catalogues, 1); assert.equal(events, 1);
  find(view.render(), node => node.type?.displayName === 'SiteDetailView').props.onVerified();
  view.render(); view.flush(); await tick(); assert.equal(passports, 2);
});

test('Plan reuses list and detail across unmounts, deduplicates pending reads and explicitly retries', async () => {
  const requests = [], route = itineraryRow();
  fetch = async url => { requests.push(url); return reply(url.endsWith('/7') ? route : [route]); };
  const props = { sites: [], savedSiteIds: [], onSelectSite() {} };
  for (let index = 0; index < 2; index++) {
    const view = harness('../src/views/PlanView.tsx', 'PlanView', props);
    view.render(); view.flush(); await tick();
    find(view.render(), node => node.props?.id === 'open-itinerary-7').props.onClick();
    view.render(); view.flush(); await tick();
    assert.ok(find(view.render(), node => node.props?.id === 'itinerary-map-toggle'));
    assert.equal(find(view.render(), node => node.type?.displayName === 'MapView'), undefined);
    find(view.render(), node => node.props?.id === 'itinerary-map-toggle').props.onClick();
    assert.ok(find(view.render(), node => node.type?.displayName === 'MapView'));
    view.unmount();
  }
  assert.deepEqual(requests, ['/api/itineraries']);
  await api.apiFetchItineraries(true); await api.apiFetchItineraryById('7', true);
  assert.equal(requests.length, 3);
  api.clearItineraryCache(); fetch = async () => reply({}, 500);
  await assert.rejects(api.apiFetchItineraries());
  fetch = async () => reply([route]); assert.equal((await api.apiFetchItineraries()).length, 1);
});

test('Site Detail keys distinguish sibling features and contribution CTA clicks the one real action', async () => {
  const site = await mappedSite(); let clicked = 0, focused = 0, refreshed = 0;
  const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site, user: visitor, onVerified() { refreshed++; } });
  let tree = view.render();
  const verification = find(tree, node => node.type?.displayName === 'VisitVerification');
  const contributions = find(tree, node => node.type?.displayName === 'VisitorExperiences');
  assert.notEqual(verification.key, contributions.key);
  verification.props.actionRef.current = { disabled: false, scrollIntoView() {}, focus() { focused++; }, click() { clicked++; } };
  assert.equal(contributions.props.onVerifyVisit(), true); assert.equal(clicked, 1); assert.equal(focused, 1);
  verification.props.onVerified(); tree = view.render();
  assert.equal(refreshed, 1);
  assert.equal(find(tree, node => node.type?.displayName === 'VisitVerification').props.alreadyVerified, true);
  assert.equal(find(tree, node => node.type?.displayName === 'VisitorExperiences').props.verificationRevision, 1);
  assert.equal(read('../src/components/VisitorExperiences.tsx').includes('getCurrentPosition'), false);
  assert.equal(read('../src/components/VisitVerification.tsx').match(/getCurrentPosition/g).length, 1);
});

test('detail mapper preserves true/false verification metadata and keeps missing or malformed metadata unknown', async () => {
  for (const value of [true, false, undefined, null, 'false', 0]) {
    fetch = async () => reply({ ...rawSite, visit_verification_enabled: value });
    const site = await api.apiFetchSiteById('1');
    assert.equal(site.visitVerificationEnabled, typeof value === 'boolean' ? value : undefined);
  }
});

test('Site Detail resolves missing metadata once and shares enabled/disabled/error state with both sections', async () => {
  const site = { ...await mappedSite(), visitVerificationEnabled: undefined };
  let checks = 0, complete, fail;
  const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site, user: visitor }, {
    '../api/client': { apiCheckinAvailability: () => { checks++; return new Promise((resolve, reject) => { complete = resolve; fail = reject; }); } },
  });
  const sections = tree => [find(tree, node => node.type?.displayName === 'VisitVerification'), find(tree, node => node.type?.displayName === 'VisitorExperiences')];
  let [verification, experiences] = sections(view.render()); view.flush();
  assert.equal(checks, 1); assert.equal(verification.props.availability, experiences.props.availability);
  assert.equal(experiences.props.availability.enabled, undefined); assert.equal(experiences.props.availability.loading, true);
  complete(true); await tick(); [verification, experiences] = sections(view.render());
  assert.equal(verification.props.availability.enabled, true); assert.equal(experiences.props.availability, verification.props.availability);
  verification.props.onRetryAvailability(); view.render(); view.flush();
  [verification, experiences] = sections(view.render()); assert.equal(experiences.props.availability.enabled, undefined);
  fail(new Error('Unable to load visit verification.')); await tick();
  [verification, experiences] = sections(view.render());
  assert.equal(experiences.props.availability.enabled, undefined); assert.equal(experiences.props.availability.loading, false);
  assert.ok(experiences.props.availability.error);
  verification.props.onRetryAvailability(); view.render(); view.flush(); complete(false); await tick();
  assert.equal(sections(view.render())[1].props.availability.enabled, false);
  const next = { ...site, id: '2', visitVerificationEnabled: true };
  [verification, experiences] = sections(view.render({ site: next, user: visitor })); view.flush();
  assert.equal(checks, 3); assert.equal(experiences.props.availability.enabled, true);
});

test('Visitor Experiences shows its verification CTA only for enabled shared state, never mistakes unknown for disabled', async () => {
  fetch = async url => reply(url.endsWith('/mine') ? contributionEligibility(null, false) : []);
  const props = { ...experienceProps, site: { ...experienceProps.site, visitVerificationEnabled: undefined } };
  const view = harness('../src/components/VisitorExperiences.tsx', 'VisitorExperiences', props);
  view.render(); view.flush(); await tick();
  const cta = tree => find(tree, node => node.type === 'button' && allText(node) === 'Verify My Visit');
  assert.ok(allText(view.render()).includes('Loading visit verification'));
  assert.equal(allText(view.render()).includes('currently unavailable'), false); assert.equal(cta(view.render()), undefined);
  let clicked = 0;
  const enabled = { ...props, availability: { enabled: true, loading: false }, onVerifyVisit() { clicked++; return true; } };
  cta(view.render(enabled)).props.onClick(); assert.equal(clicked, 1);
  const disabled = view.render({ ...props, availability: { enabled: false, loading: false } });
  assert.ok(allText(disabled).includes('currently unavailable')); assert.equal(cta(disabled), undefined);
  const failed = view.render({ ...props, availability: { loading: false, error: 'Unable to connect.' } });
  assert.equal(allText(failed).includes('currently unavailable'), false); assert.ok(allText(failed).includes('Retry in the Heritage Passport'));
});

test('shared availability keeps the real verification button clickable and does not start a second availability request', async () => {
  let checks = 0, locations = 0, callback, posts = 0, refreshed = 0;
  const props = { ...checkinProps, availability: { enabled: true, loading: false }, onVerified() { refreshed++; } };
  const view = harness('../src/components/VisitVerification.tsx', 'VisitVerification', props, {
    '../api/client': {
      apiCheckinAvailability: async () => { checks++; return true; },
      apiVerifyVisit: async () => { posts++; return { status: 'verified', points_earned: 100, visit: { verified_at: '2026-10-09', points_awarded: 100 } }; },
    },
    __window: { isSecureContext: true }, __navigator: { geolocation: { getCurrentPosition(success) { locations++; callback = success; } } },
  });
  view.render(); view.flush();
  const button = find(view.render(), node => node.props?.id === 'verify-location');
  assert.equal(button.props.disabled, false); button.props.onClick();
  await callback({ coords: { latitude: 15, longitude: 120, accuracy: 10 } });
  assert.equal(checks, 0); assert.equal(locations, 1); assert.equal(posts, 1); assert.equal(refreshed, 1);
  assert.ok(allText(view.render()).includes('+100 Points'));
});

test('detail verification metadata skips availability and already verified users do not request location', async () => {
  let checks = 0, geolocation = 0;
  const view = harness('../src/components/VisitVerification.tsx', 'VisitVerification', { ...checkinProps, site: { ...checkinProps.site, visitVerificationEnabled: true }, alreadyVerified: true }, {
    '../api/client': { apiCheckinAvailability: async () => { checks++; return true; } },
    __window: { isSecureContext: true }, __navigator: { geolocation: { getCurrentPosition() { geolocation++; } } },
  });
  view.render(); view.flush(); await tick();
  assert.equal(checks, 0); assert.equal(geolocation, 0);
  assert.ok(allText(view.render()).includes('Your visit is verified.'));
  assert.equal(find(view.render(), node => node.props?.id === 'verify-location'), undefined);
});

test('synchronous geolocation failure unlocks the real verification button for retry', async () => {
  const view = harness('../src/components/VisitVerification.tsx', 'VisitVerification', checkinProps, {
    '../api/client': { apiCheckinAvailability: async () => true }, __window: { isSecureContext: true },
    __navigator: { geolocation: { getCurrentPosition() { throw new Error('browser error'); } } },
  });
  view.render(); view.flush(); await tick();
  for (let attempt = 0; attempt < 2; attempt++) {
    find(view.render(), node => node.props?.id === 'verify-location').props.onClick();
    assert.equal(find(view.render(), node => node.props?.id === 'verify-location').props.disabled, false);
    assert.ok(allText(view.render()).includes('Location unavailable'));
  }
});

test('event images use the guaranteed local fallback once even if the fallback errors', () => {
  const event = api.mapBackendEvent({ id: 1, image_path: 'events/missing.jpg' });
  assert.equal(event.bannerImage, '/storage/events/missing.jpg');
  assert.equal(api.mapBackendEvent({ id: 2 }).bannerImage, imageHelpers.HERITAGE_IMAGE_PLACEHOLDER);
  const view = harness('../src/views/EventsView.tsx', 'EventsView', { events: [event], sites: [], savedEventIds: [], onToggleSaveEvent() {} });
  const image = find(view.render(), node => node.type === 'img' && node.props.src === event.bannerImage);
  let assignments = 0, src = event.bannerImage;
  const element = { getAttribute() { return src; }, get src() { return src; }, set src(value) { assignments++; src = value; } };
  image.props.onError({ currentTarget: element }); image.props.onError({ currentTarget: element });
  assert.equal(assignments, 1); assert.equal(src, imageHelpers.HERITAGE_IMAGE_PLACEHOLDER);
  assert.ok(read('../public/images/heritage-placeholder.svg'));
});

test('chatbot fetches full recorded details only after a question selects a summary site', async () => {
  const site = { ...await mappedSite(), isSummary: true, name: 'Recorded landmark', fullDescription: '', story: '' }, requests = [];
  fetch = async url => { requests.push(url); return reply({ ...rawSite, name: site.name, description: 'Complete recorded overview', history: 'Complete recorded history', opening_hours: 'Recorded hours', timelines: [{ year: '1900', title: 'Milestone', description: 'Recorded milestone' }] }); };
  const view = harness('../src/components/HeritageChatbot.tsx', 'HeritageChatbot', { sites: [site], onSelectSite() {} }, { 'motion/react': motionModule });
  view.render(); view.flush(); assert.equal(requests.length, 0);
  find(view.render(), node => node.props?.id === 'heritage-chatbot-trigger-btn').props.onClick(); view.render(); view.flush(); view.runTimers();
  const input = find(view.render(), node => node.type === 'input'); input.props.onChange({ target: { value: site.name } });
  find(view.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await tick();
  assert.deepEqual(requests, ['/api/heritage-sites/1']);
  assert.ok(allText(view.render()).includes('Complete recorded history') && allText(view.render()).includes('Recorded hours'));
});

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
  await settleMap(view);
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
    emit(name, event) { listeners.get(name)?.(event); },
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
  await settleMap(view);
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
  const markers = [], polygons = [], tiles = [], options = [], fits = [], maxBounds = [], minZooms = [], lines = [];
  const map = { remove() { this.removed = true; }, removeLayer(layer) { layer.removed = true; }, addLayer(layer) { layer.removed = false; }, setView() {}, panTo() {}, zoomIn() {}, zoomOut() {}, invalidateSize() {}, getBoundsZoom() { return 12; }, setMinZoom(zoom) { minZooms.push(zoom); }, fitBounds(bounds, config) { fits.push({ bounds, config }); }, setMaxBounds(bounds) { maxBounds.push(bounds); } };
  map.zoom = 12; map.events = {};
  map.getZoom = () => map.zoom;
  map.on = (event, callback) => { map.events[event] = callback; };
  map.off = event => { delete map.events[event]; };
  const layer = () => ({ addTo() { return this; }, remove() { this.removed = true; }, on(event, callback) { this[event] = callback; return this; } });
  return { markers, polygons, tiles, options, fits, maxBounds, minZooms, lines, map, leaflet: {
    polyline: (points, config) => { const line = { ...layer(), points, config, getBounds: () => points }; lines.push(line); return line; },
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
  await settleMap(view); assert.equal(runtime.markers[0].config.zIndexOffset, 1000);
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
  let tree = await settleMap(view);
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
  await settleMap(view);
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

test('directory defers Leaflet and boundary until map is revealed; late boundary ignores unmounted maps', async () => {
  let finish; const runtime = mapRuntime(); const site = await mappedSite();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [site], savedSiteIds: [] }, {
    leaflet: runtime.leaflet, 'motion/react': motionModule, '../utils/cityBoundary': { ...cityHelpers, loadCityBoundary: () => new Promise(resolve => { finish = resolve; }) },
  });
  await settleMap(view);
  assert.equal(finish, undefined); assert.equal(runtime.options.length, 0);
  assert.equal(runtime.fits.length, 0);
  find(view.render(), node => node.props?.id === 'toggle-map-view').props.onClick(); await settleMap(view);
  finish(cityHelpers.parseCityBoundary(cityGeoJSON)); await tick(); view.runTimers();
  assert.deepEqual(runtime.fits[0].bounds, cityHelpers.parseCityBoundary(cityGeoJSON).bounds);
  view.unmount(); assert.equal(runtime.map.removed, true);
  const late = mapRuntime(); let complete;
  const pending = harness('../src/views/MapView.tsx', 'MapView', { sites: [site], savedSiteIds: [], initialViewMode: 'map' }, {
    leaflet: late.leaflet, 'motion/react': motionModule, '../utils/cityBoundary': { ...cityHelpers, loadCityBoundary: () => new Promise(resolve => { complete = resolve; }) },
  });
  await settleMap(pending); pending.unmount(); complete(cityHelpers.parseCityBoundary(cityGeoJSON)); await tick();
  assert.equal(late.polygons.length, 0); assert.equal(late.fits.length, 0);
});

test('boundary loading respects an overlay disabled before arrival and can toggle afterward', async () => {
  let finish; const runtime = mapRuntime();
  const view = harness('../src/views/MapView.tsx', 'MapView', { sites: [await mappedSite()], initialViewMode: 'map', savedSiteIds: [] }, {
    leaflet: runtime.leaflet, 'motion/react': motionModule, '../utils/cityBoundary': { ...cityHelpers, loadCityBoundary: () => new Promise(resolve => { finish = resolve; }) },
  });
  await settleMap(view);
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
  await settleMap(view); view.runTimers();
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
  await settleMap(view);
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
  await settleMap(view);
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
  fetch = async () => reply({}, 404); assert.equal(await api.apiFetchItineraryById('7', true), null);
  for (const response of [() => reply({}, 500), () => reply({}), () => reply([{ ...route, stops: [{ ...route.stops[0], heritage_site_id: 99 }] }]), () => { throw new Error('offline'); }]) {
    fetch = async () => response(); await assert.rejects(api.apiFetchItineraries(true), /Unable to load|Unable to connect|temporarily unavailable|unexpected response/);
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
  assert.ok(visibleText(view.render()).includes('1 stop has no verified map location'));
  for (const fake of [' km', 'Hours', 'difficulty', 'popularity']) assert.equal(content.includes(fake), false);
  assert.deepEqual(requests, ['/api/itineraries']);
});

test('Recommended load errors and archived detail have clear retry/unavailable states', async () => {
  fetch = async () => reply({}, 500);
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [], savedSiteIds: [] });
  view.render(); view.flush(); await tick(); assert.ok(find(view.render(), node => node.props?.role === 'alert'));
  fetch = async () => reply([itineraryRow()]);
  find(view.render(), node => node.type === 'button' && allText(node) === 'Retry').props.onClick(); view.render(); view.flush(); await tick();
  fetch = async () => reply({}, 404); api.clearItineraryCache();
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

const roadFixture = { code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[120.69, 15.03], [120.70, 15.04]] }, distance: 12400, duration: 1680 }] };
test('OSRM uses ordered public lon,lat coordinates, omits private data and caches the session route', async () => {
  const first = await mappedSite(), second = { ...first, id: '2', coordinates: { lat: 15.04, lng: 120.70 } };
  const sites = [{ ...first, coordinates: { lat: 15.03, lng: 120.69 } }, { ...first, id: '3', coordinates: null }, second];
  const key = osrm.routeKey(sites), requests = [];
  assert.equal(key, '120.69,15.03;120.7,15.04');
  fetch = async (url, options) => { requests.push({ url, options }); return reply(roadFixture); };
  const [a, b] = await Promise.all([osrm.fetchRoadRoute(key), osrm.fetchRoadRoute(key)]);
  assert.equal(a, b); assert.equal(requests.length, 1);
  assert.ok(requests[0].url.endsWith('/route/v1/driving/' + key + '?overview=full&geometries=geojson&steps=false'));
  assert.equal(requests[0].options.credentials, 'omit'); assert.equal(requests[0].options.headers, undefined);
  assert.equal(a.distance, 12400); assert.equal(a.duration, 1680);
  await osrm.fetchRoadRoute(key); assert.equal(requests.length, 1);
  const reordered = osrm.routeKey([...sites].reverse()); assert.notEqual(reordered, key);
  await osrm.fetchRoadRoute(reordered); assert.equal(requests.length, 2);
  assert.equal(osrm.routeKey([{ ...first, coordinates: { lat: NaN, lng: 120 } }]), '');
});
for (const [label, response] of [
  ['offline', () => { throw new Error('private network detail'); }],
  ['rate limited', () => reply({}, 429)], ['server error', () => reply({}, 500)],
  ['no route', () => reply({ code: 'NoRoute', routes: [] })],
  ['invalid geometry', () => reply({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[120, 91], [120, 15]] }, distance: 1, duration: 1 }] })],
  ['invalid distance', () => reply({ ...roadFixture, routes: [{ ...roadFixture.routes[0], distance: '100' }] })],
  ['malformed JSON', () => new Response('<html>private exception</html>')],
]) test('OSRM ' + label + ' returns safe fallback and permits retry', async () => {
  let count = 0; fetch = async () => { count++; return response(); };
  await assert.rejects(osrm.fetchRoadRoute('120,15;121,16'), error => error.message === osrm.ROAD_ROUTE_UNAVAILABLE);
  fetch = async () => { count++; return reply(roadFixture); };
  await osrm.fetchRoadRoute('120,15;121,16'); assert.equal(count, 2);
});
test('OSRM fewer than two mapped stops never makes a request', async () => {
  let count = 0; fetch = async () => { count++; return reply(roadFixture); };
  for (const key of ['', '120,15']) await assert.rejects(osrm.fetchRoadRoute(key));
  assert.equal(count, 0);
});
test('Plan requests OSRM only after map opens; edits close map and use a new ordered key', async () => {
  const first = { ...await mappedSite(), coordinates: { lat: 15.03, lng: 120.69 } }, second = { ...first, id: '2', name: 'Second stop', coordinates: { lat: 15.04, lng: 120.70 } };
  localStorage.setItem(customHelpers.CUSTOM_ITINERARY_KEY, '["1","2"]');
  let routes = 0;
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [first, second], savedSiteIds: [], onSelectSite() {} }, { '../api/client': { apiFetchItineraries: async () => [] }, '../utils/osrm': { ...osrm, fetchRoadRoute: async key => { routes++; return { ...roadFixture.routes[0], coordinates: roadFixture.routes[0].geometry.coordinates, key }; } } });
  view.render(); view.flush(); await tick();
  find(view.render(), node => node.props?.id === 'plan-custom-tab').props.onClick(); view.render(); view.flush();
  assert.equal(routes, 0);
  find(view.render(), node => node.props?.id === 'itinerary-map-toggle').props.onClick(); view.render(); view.flush(); await tick();
  assert.equal(routes, 1); assert.ok(visibleText(view.render()).includes('12.4 km')); assert.ok(visibleText(view.render()).includes('28 min'));
  const map = find(view.render(), node => node.type?.displayName === 'MapView'); assert.ok(map.props.roadRoute); assert.equal(map.props.orderedStops, true);
  find(view.render(), node => node.props?.id === 'custom-down-1').props.onClick(); view.render(); view.flush();
  assert.equal(routes, 1); assert.equal(find(view.render(), node => node.type?.displayName === 'MapView'), undefined);
  find(view.render(), node => node.props?.id === 'itinerary-map-toggle').props.onClick(); view.render(); view.flush(); await tick(); assert.equal(routes, 2);
});
test('Plan OSRM failure preserves map markers and ordered stop list', async () => {
  const first = await mappedSite(), second = { ...first, id: '2', name: 'Second stop', coordinates: { lat: 15.04, lng: 120.70 } };
  localStorage.setItem(customHelpers.CUSTOM_ITINERARY_KEY, '["1","2"]');
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [first, second], savedSiteIds: [], onSelectSite() {} }, { '../api/client': { apiFetchItineraries: async () => [] }, '../utils/osrm': { ...osrm, fetchRoadRoute: async () => { throw new Error('offline'); } } });
  view.render(); view.flush(); await tick(); find(view.render(), node => node.props?.id === 'plan-custom-tab').props.onClick();
  find(view.render(), node => node.props?.id === 'itinerary-map-toggle').props.onClick(); view.render(); view.flush(); await tick();
  assert.ok(visibleText(view.render()).includes(osrm.ROAD_ROUTE_UNAVAILABLE));
  assert.equal(find(view.render(), node => node.type?.displayName === 'MapView').props.sites.length, 2);
  assert.ok(find(view.render(), node => node.props?.id === 'itinerary-view-site-2'));
});
test('Map draws actual OSRM geometry, fits it and numbers stops in itinerary order', async () => {
  const first = await mappedSite(), second = { ...first, id: '2', name: 'Earlier alphabetically', coordinates: { lat: 15.04, lng: 120.70 } }, runtime = mapRuntime();
  const props = { sites: [first, second], roadRoute: { coordinates: roadFixture.routes[0].geometry.coordinates, distance: 12400, duration: 1680 }, orderedStops: true, initialViewMode: 'map', savedSiteIds: [] };
  const view = harness('../src/views/MapView.tsx', 'MapView', props, { leaflet: runtime.leaflet, 'motion/react': motionModule });
  await settleMap(view);
  assert.deepEqual(runtime.lines[0].points.map(point => Array.from(point)), [[15.03, 120.69], [15.04, 120.70]]);
  assert.ok(runtime.fits.some(fit => fit.bounds === runtime.lines[0].points));
  assert.ok(runtime.markers.find(marker => marker.config.title === first.name).config.icon.html.includes('>1<'));
  view.unmount(); assert.equal(runtime.lines[0].removed, true);
});
test('Passport opens from Profile over current page and reuses data on reopen', async () => {
  let count = 0; const browser = browserAt('#/explore');
  const view = harness('../src/App.tsx', 'default', {}, { __window: browser, './api/client': { ...api, apiFetchSites: async () => [], apiFetchEvents: async () => [], apiFetchCurrentUser: async () => visitor, apiFetchPassport: async () => { count++; return { visits: [], eligible_sites: [] }; } } });
  view.render(); view.flush(); await tick(); view.render(); view.flush(); await tick(); assert.equal(count, 0);
  find(view.render(), node => node.type?.displayName === 'AuthModal').props.onOpenPassport(); view.render(); view.flush(); await tick();
  assert.equal(count, 1); assert.equal(browser.location.hash, '#/explore');
  assert.ok(find(view.render(), node => node.type?.displayName === 'ExploreView'));
  assert.equal(find(view.render(), node => node.props?.id === 'san-fernando-app-root').props.inert, true);
  find(view.render(), node => node.type?.displayName === 'PassportModal').props.onClose(); view.render(); view.flush();
  find(view.render(), node => node.type?.displayName === 'AuthModal').props.onOpenPassport(); view.render(); view.flush(); await tick(); assert.equal(count, 1);
});

test('OSRM timeout aborts the request and returns the safe marker fallback', async () => {
  let timeout, cleared = false;
  const exports = {};
  vm.runInNewContext(compile(read('../src/utils/osrm.ts').replace('import.meta.env?.VITE_OSRM_BASE_URL', 'undefined')), {
    exports, AbortController, Error,
    setTimeout(callback) { timeout = callback; return 1; }, clearTimeout() { cleared = true; },
    fetch: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout')))),
    require: name => name === './heritageCoordinates' ? coordinates : {},
  });
  const request = exports.fetchRoadRoute('120,15;121,16'); timeout();
  await assert.rejects(request, error => error.message === osrm.ROAD_ROUTE_UNAVAILABLE); assert.equal(cleared, true);
});
test('archival Site Detail renders recorded text, populated visitor fields and separate official photos', async () => {
  const site = { ...await mappedSite(), fullDescription: 'Recorded detailed overview', story: 'Recorded historical significance', visitInfo: { openingHours: 'Recorded hours', entranceFee: '' }, timeline: [{ id: 42, year: '1900', title: 'Recorded timeline', description: 'Recorded timeline detail' }], images: [{ id: 1, isCover: true, imageUrl: 'official-cover.jpg' }, { id: 2, imageUrl: 'official-gallery.jpg', caption: 'Recorded gallery caption' }], didYouKnow: [] };
  const view = harness('../src/views/SiteDetailView.tsx', 'SiteDetailView', { site }); const tree = view.render(), text = visibleText(tree);
  for (const value of ['About This Landmark', 'Recorded detailed overview', 'Recorded historical significance', 'Recorded timeline', 'Recorded hours']) assert.ok(text.includes(value));
  assert.equal(text.includes('Entrance Fee'), false); assert.equal(text.includes('Historical Note #1'), false); assert.equal(text.includes('Archival Annotations'), false);
  const gallery = find(tree, node => node.props?.id === 'section-site-gallery'); assert.equal(find(gallery, node => node.type === 'img').props.src, 'official-gallery.jpg');
  assert.ok(find(tree, node => node.type?.displayName === 'VisitorExperiences'));
});

test('legacy Passport address does not open a page/modal or fetch Passport; profile alone opens it', async () => {
  let count = 0; const browser = browserAt('#/passport');
  const view = harness('../src/App.tsx', 'default', {}, { __window: browser, './api/client': { ...api, apiFetchSites: async () => [], apiFetchEvents: async () => [], apiFetchCurrentUser: async () => visitor, apiFetchPassport: async () => { count++; return { visits: [], eligible_sites: [] }; } } });
  view.render(); view.flush(); await tick(); view.render(); view.flush(); await tick();
  assert.equal(count, 0); assert.equal(find(view.render(), node => node.type?.displayName === 'PassportModal'), undefined);
  find(view.render(), node => node.type?.displayName === 'Header').props.onNavigate('passport'); view.render(); view.flush(); await tick();
  assert.equal(count, 0); assert.equal(find(view.render(), node => node.type?.displayName === 'AuthModal').props.isOpen, true);
  find(view.render(), node => node.type?.displayName === 'AuthModal').props.onOpenPassport(); view.render(); view.flush(); await tick();
  assert.equal(count, 1); assert.ok(find(view.render(), node => node.type?.displayName === 'PassportModal'));
});
test('guest profile callback cannot open Passport or request its data', async () => {
  let count = 0;
  const view = harness('../src/App.tsx', 'default', {}, { __window: browserAt('#/home'), './api/client': { ...api, apiFetchSites: async () => [], apiFetchEvents: async () => [], apiFetchCurrentUser: async () => null, apiFetchPassport: async () => { count++; } } });
  view.render(); view.flush(); await tick(); find(view.render(), node => node.type?.displayName === 'AuthModal').props.onOpenPassport();
  view.render(); view.flush(); await tick(); assert.equal(count, 0); assert.equal(find(view.render(), node => node.type?.displayName === 'PassportModal'), undefined);
});
test('verification invalidates closed cached Passport and next profile open receives updated points', async () => {
  let count = 0; const site = await mappedSite();
  const view = harness('../src/App.tsx', 'default', {}, { __window: browserAt('#/heritage/1'), './api/client': { ...api, apiFetchSites: async () => [site], apiFetchSiteById: async () => site, apiFetchEvents: async () => [], apiFetchCurrentUser: async () => visitor, apiFetchPassport: async () => ({ visits: [], eligible_sites: [], total_points: ++count * 100 }) } });
  view.render(); view.flush(); await tick(); view.render(); view.flush(); await tick();
  find(view.render(), node => node.type?.displayName === 'AuthModal').props.onOpenPassport(); view.render(); view.flush(); await tick();
  assert.equal(find(view.render(), node => node.type?.displayName === 'PassportView').props.passport.total_points, 100);
  find(view.render(), node => node.type?.displayName === 'PassportModal').props.onClose(); view.render(); view.flush();
  find(view.render(), node => node.type?.displayName === 'SiteDetailView').props.onVerified(); view.render(); view.flush(); await tick(); assert.equal(count, 1);
  find(view.render(), node => node.type?.displayName === 'AuthModal').props.onOpenPassport(); view.render(); view.flush(); await tick();
  assert.equal(count, 2); assert.equal(find(view.render(), node => node.type?.displayName === 'PassportView').props.passport.total_points, 200);
});

test('itinerary summary sits below description, requests no route until opened and keeps estimates after hiding map', async () => {
  const first = { ...await mappedSite(), heroImage: '', name: 'First stop' }, second = { ...first, id: '2', name: 'Second stop', heroImage: 'cover.jpg', coordinates: { lat: 15.04, lng: 120.7 } };
  const route = { id: '7', name: 'Ordered route', description: 'Recorded itinerary description', stops: [{ id: '1', site: first }, { id: '2', site: second }] };
  let count = 0, finish;
  const view = harness('../src/views/PlanView.tsx', 'PlanView', { sites: [], savedSiteIds: [], visitedSiteIds: ['1'] }, { '../api/client': { apiFetchItineraries: async () => [route], apiFetchItineraryById: async () => route }, '../utils/osrm': { ...osrm, fetchRoadRoute: async () => { count++; return new Promise(resolve => { finish = () => resolve({ coordinates: [[120,15],[120.7,15.04]], distance: 12400, duration: 1680 }); }); } } });
  view.render(); view.flush(); await tick(); find(view.render(), node => node.props?.id === 'open-itinerary-7').props.onClick(); view.render(); view.flush(); await tick();
  const tree = view.render(), summary = find(tree, node => node.props?.id === 'itinerary-route-summary');
  assert.ok(summary); assert.ok(visibleText(summary).includes('Total stops2'));
  assert.ok(visibleText(summary).includes('Not estimated yet')); assert.ok(visibleText(summary).includes('OSRM'));
  assert.ok(visibleText(tree).indexOf('Recorded itinerary description') < visibleText(tree).indexOf('Route Summary'));
  assert.ok(visibleText(tree).indexOf('Route Summary') < visibleText(tree).indexOf('Stop 1')); assert.equal(count, 0);
  assert.equal(find(tree, node => node.type?.displayName === 'MapView'), undefined);
  const images = []; walk(find(tree, node => node.type === 'ol'), node => { if (node.type === 'img') images.push(node); });
  assert.equal(images.length, 2); assert.equal(images[0].props.src, imageHelpers.HERITAGE_IMAGE_PLACEHOLDER);
  assert.equal(images[1].props.src, 'cover.jpg'); assert.equal(images[0].props.loading, 'lazy');
  assert.ok(visibleText(tree).includes('Visited')); assert.ok(visibleText(tree).includes('Not yet visited'));
  const toggle = find(tree, node => node.props?.id === 'itinerary-map-toggle'); assert.equal(visibleText(toggle), 'View Route on Map'); toggle.props.onClick(); view.render(); view.flush();
  assert.equal(count, 1); assert.ok(visibleText(view.render()).includes('Calculating'));
  finish(); await tick(); assert.ok(visibleText(view.render()).includes('12.4 km')); assert.ok(visibleText(view.render()).includes('28 min'));
  find(view.render(), node => node.props?.id === 'itinerary-map-toggle').props.onClick(); view.render(); view.flush();
  assert.ok(visibleText(view.render()).includes('12.4 km')); assert.equal(find(view.render(), node => node.type?.displayName === 'MapView'), undefined); assert.equal(count, 1);
});
