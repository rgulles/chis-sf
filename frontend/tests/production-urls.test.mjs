import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { beforeEach } from 'node:test';
import ts from 'typescript';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const moduleUrl = (source, env) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(
  source.replaceAll('import.meta.env', `(${JSON.stringify(env)})`),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } },
).outputText).toString('base64')}`;
const loadClient = env => {
  const images = moduleUrl(read('../src/utils/heritageImages.ts'), env);
  return import(moduleUrl(read('../src/api/client.ts').replace("'../utils/heritageImages'", JSON.stringify(images)), env));
};
const railway = 'https://chis-sf-production.up.railway.app';
const user = { id: 1, name: 'Test visitor', email: 'visitor@example.com', role: 'traveler' };

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
});

for (const configuredBase of [railway, railway + '/', railway + '/api', railway + '/api///', ' ' + railway + '/api/api/ ']) {
  test(`shared client routes public and JWT API calls to Railway: ${configuredBase}`, async () => {
    const api = await loadClient({ VITE_API_BASE_URL: configuredBase });
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, authorization: new Headers(options?.headers).get('Authorization') });
      if (url.endsWith('/auth/login') || url.endsWith('/auth/google')) {
        return Response.json({ user, access_token: 'test-jwt', token_type: 'bearer', expires_in: 3600 });
      }
      if (url.endsWith('/passport')) {
        return Response.json({ total_points: 0, visited_count: 0, eligible_site_count: 0, visited_eligible_count: 0, visits: [], eligible_sites: [] });
      }
      return Response.json([]);
    };
    await api.apiFetchSites();
    await api.apiFetchEvents();
    await api.apiGoogleLogin('test-google-identity');
    await api.apiLogin('visitor@example.com', 'test-password');
    await api.apiFetchPassport();
    await api.apiFetchAdminItineraries();
    await api.apiLogout();
    assert.deepEqual(requests.map(request => request.url), [
      '/heritage-sites', '/events', '/auth/google', '/auth/login', '/passport', '/admin/itineraries', '/auth/logout',
    ].map(path => railway + '/api' + path));
    assert.ok(requests.every(request => !request.url.includes('chis-sf.vercel.app/api')));
    assert.equal(requests[0].authorization, null);
    assert.equal(requests[1].authorization, null);
    for (const index of [4, 5, 6]) assert.equal(requests[index].authorization, 'Bearer test-jwt');
  });
}

test('without an API environment variable local development keeps relative Vite proxy paths', async () => {
  const api = await loadClient({});
  const requests = [];
  globalThis.fetch = async url => { requests.push(url); return Response.json([]); };
  await api.apiFetchSites();
  await api.apiFetchEvents();
  assert.deepEqual(requests, ['/api/heritage-sites', '/api/events']);
});

test('production storage prefixes relative uploads while preserving S3 URLs and frontend assets', async () => {
  const { heritageImageUrl } = await import(moduleUrl(read('../src/utils/heritageImages.ts'), { VITE_STORAGE_BASE_URL: railway + '/' }));
  for (const path of ['/storage/heritage-sites/photo.jpg', 'storage/heritage-sites/photo.jpg', 'heritage-sites/photo.jpg']) {
    assert.equal(heritageImageUrl(path), railway + '/storage/heritage-sites/photo.jpg');
  }
  const signedS3 = 'https://cgsfp-hackathon.s3.amazonaws.com/photo.jpg?X-Amz-Signature=test';
  assert.equal(heritageImageUrl(signedS3), signedS3);
  assert.equal(heritageImageUrl('/images/heritage-placeholder.svg'), '/images/heritage-placeholder.svg');
  assert.equal(heritageImageUrl('/storage/photo.jpg', ' ' + railway + '/api/ '), railway + '/storage/photo.jpg');
  assert.equal(heritageImageUrl('/storage/photo.jpg', ''), '/storage/photo.jpg');
});
