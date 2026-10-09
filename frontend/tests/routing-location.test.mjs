import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../src/utils/routingLocation.ts');
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
function locationModule({ secure = true, geolocation } = {}) {
  const exports = {};
  vm.runInNewContext(compile(source), { exports, window: { isSecureContext: secure }, navigator: { geolocation }, Error });
  return exports;
}
test('routing module requests no location until explicitly called; successful fix and lon,lat key', async () => {
  let calls = 0, options;
  const utils = locationModule({ geolocation: { getCurrentPosition(ok, fail, config) { calls++; options = config; ok({ coords: { latitude: 15.03123456, longitude: 120.68123456 } }); } } });
  assert.equal(calls, 0);
  const point = await utils.currentRoutingLocation(); assert.equal(calls, 1);
  assert.equal(point.lat, 15.03123456); assert.equal(point.lng, 120.68123456);
  assert.equal(utils.currentLocationRouteKey(point, { lat: 15.04, lng: 120.7 }), '120.68123,15.03123;120.7,15.04');
  assert.equal(options.enableHighAccuracy, true); assert.equal(options.timeout, 12000); assert.equal(options.maximumAge, 30000);
});
for (const [code, pattern] of [[1, /permission was denied/], [2, /unavailable/], [3, /timed out/]]) test('routing geolocation error ' + code, async () => {
  const utils = locationModule({ geolocation: { getCurrentPosition(ok, fail) { fail({ code }); } } });
  await assert.rejects(utils.currentRoutingLocation(), pattern);
});
test('routing detects insecure context and unsupported browser without requesting a fix', async () => {
  await assert.rejects(locationModule({ secure: false }).currentRoutingLocation(), /HTTPS/);
  await assert.rejects(locationModule().currentRoutingLocation(), /does not support/);
});
test('routing rejects invalid coordinates and has no persistent storage or analytics', async () => {
  const utils = locationModule({ geolocation: { getCurrentPosition(ok) { ok({ coords: { latitude: NaN, longitude: 120 } }); } } });
  await assert.rejects(utils.currentRoutingLocation(), /unavailable/);
  for (const file of ['../src/utils/routingLocation.ts', '../src/components/DirectionsPanel.tsx', '../src/views/MapView.tsx', '../src/utils/osrm.ts']) assert.doesNotMatch(read(file), /localStorage|sessionStorage|sendBeacon|analytics/);
});
