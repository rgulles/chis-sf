import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const imagesUrl = moduleUrl(read('../src/utils/heritageImages.ts'));
const api = await import(moduleUrl(read('../src/api/client.ts').replaceAll("'../utils/heritageImages'", JSON.stringify(imagesUrl))));
const images = await import(imagesUrl);
const record = { id: 1, title: 'Recorded event', event_date: '2026-10-09', start_time: '18:00', end_time: '21:00', status: 'upcoming', schedules: [{ id: 7, schedule_time: '18:00', title: 'Recorded program', description: 'Recorded activity' }] };
test('explicit null event image uses existing placeholder even with a stored unresolved S3 path', () => {
  const event = api.mapBackendEvent({ ...record, image_path: 'events/missing-s3.jpg', image_url: null });
  assert.equal(event.bannerImage, images.HERITAGE_IMAGE_PLACEHOLDER);
  assert.equal(event.title, record.title); assert.equal(event.status, record.status); assert.equal(event.event_date, record.event_date);
  assert.equal(event.start_time, record.start_time); assert.equal(event.end_time, record.end_time);
  assert.deepEqual(event.schedule, [{ id: 7, time: '18:00', activity: 'Recorded program', description: 'Recorded activity' }]);
});
test('absent, empty and malformed event image fields map safely to existing placeholder', () => {
  for (const fields of [{}, { image_path: null }, { image_url: '' }, { image_url: 42, image_path: 'events/unresolved.jpg' }]) assert.equal(api.mapBackendEvent({ ...record, ...fields }).bannerImage, images.HERITAGE_IMAGE_PLACEHOLDER);
});
test('legacy event APIs omitting image_url preserve storage path compatibility', () => {
  for (const image_path of ['/storage/events/old.jpg', 'storage/events/old.jpg', 'events/old.jpg']) assert.equal(api.mapBackendEvent({ ...record, image_path }).bannerImage, '/storage/events/old.jpg');
});
test('resolved absolute event image URLs are preserved', () => {
  assert.equal(api.mapBackendEvent({ ...record, image_url: 'https://cdn.example.test/event.jpg' }).bannerImage, 'https://cdn.example.test/event.jpg');
  assert.equal(api.mapBackendEvent({ ...record, image_path: 'https://example.test/old.jpg' }).bannerImage, 'https://example.test/old.jpg');
});
test('unavailable image falls back without changing the Events error/retry flow', () => {
  const image = { src: 'https://example.test/missing.jpg', onerror() {}, getAttribute() { return this.src; } };
  images.handleHeritageImageError({ currentTarget: image });
  assert.equal(image.src, images.HERITAGE_IMAGE_PLACEHOLDER); assert.equal(image.onerror, null);
  assert.match(read('../src/views/EventsView.tsx'), /onError=\{handleHeritageImageError\}/);
});
