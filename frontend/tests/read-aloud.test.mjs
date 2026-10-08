import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const speechExports = {};
vm.runInNewContext(compile(read('../src/utils/heritageSpeechText.ts')), { exports: speechExports });
const speechText = speechExports.heritageSpeechText;
const site = { id: '4', name: 'Real landmark', shortDescription: 'Database description.', fullDescription: 'Database description.', story: 'Database history.' };
function walk(node, visit) {
  if (Array.isArray(node)) return node.forEach(child => walk(child, visit));
  if (!node || typeof node !== 'object') return;
  visit(node); walk(node.props?.children, visit);
}
function find(tree, predicate) { let result; walk(tree, node => { if (!result && predicate(node)) result = node; }); return result; }
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (tree && typeof tree === 'object') return text(tree.props?.children);
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
}
function engine() {
  const calls = [], utterances = [];
  return {
    calls, utterances, paused: false,
    speak(utterance) { calls.push('speak'); utterances.push(utterance); },
    cancel() { calls.push('cancel'); },
    pause() { calls.push('pause'); this.paused = true; },
    resume() { calls.push('resume'); this.paused = false; },
  };
}

// Exercise the actual keyed toolbar lifecycle and callbacks without a new test dependency.
function player(initialSite = site, synthesis = engine(), extra = {}) {
  let props = { site: initialSite }, slots = [], effects = [], pending = [], cursor = 0, key;
  const cleanup = () => { effects.forEach(effect => effect?.cleanup?.()); effects = []; pending = []; slots = []; };
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useId() { const index = cursor++; return slots[index] ??= 'read-aloud-speed'; },
    useEffect(callback, deps) {
      const index = cursor++, previous = effects[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) pending.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; });
    },
  };
  const window = synthesis ? { speechSynthesis: synthesis, SpeechSynthesisUtterance: class { constructor(value) { this.text = value; } }, ...extra } : extra;
  const exports = {};
  vm.runInNewContext(compile(read('../src/components/HeritageReadAloud.tsx')), {
    exports, window,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../utils/heritageSpeechText') return speechExports;
      if (name === 'lucide-react') return new Proxy({}, { get: (_, name) => String(name) });
      throw new Error(name);
    },
  });
  return {
    synthesis,
    render(nextSite = props.site) {
      props = { site: nextSite };
      const element = exports.HeritageReadAloud(props);
      if (!element) { cleanup(); key = undefined; return null; }
      if (key !== element.key) { cleanup(); key = element.key; }
      cursor = 0; return element.type(element.props);
    },
    flush() { const callbacks = pending; pending = []; callbacks.forEach(callback => callback()); },
    unmount: cleanup,
  };
}
const action = (view, label) => find(view.render(), node => node.type === 'button' && node.props['aria-label'] === label);

test('normal UI font utilities share Plus Jakarta Sans; editorial headings are explicit', () => {
  const css = read('../src/index.css');
  assert.match(css, /@theme\s*{[^}]*--font-sans: 'Plus Jakarta Sans'/);
  assert.match(css, /body\s*{\s*font-family: var\(--font-sans\)/);
  assert.match(css, /h1, h2, h3, h4, h5, h6\s*{ font-family: var\(--font-sans\)/);
  assert.match(css, /\.font-editorial\s*{ font-family: var\(--font-serif\)/);
  assert.equal(/Outfit|Cinzel|Montserrat/.test(css), false);
  assert.match(read('../index.html'), /family=Plus\+Jakarta\+Sans/);
  assert.match(read('../index.html'), /family=Playfair\+Display/);
  for (const name of ['page-title','section-title','ui-card','ui-label','ui-control','ui-button-primary','ui-button-secondary','status-error','status-success']) assert.ok(css.includes('.' + name));
  for (const file of ['views/AdminView.tsx','components/AdminCheckins.tsx','components/AdminItineraries.tsx','components/AdminTravelers.tsx']) {
    const source = read('../src/' + file);
    assert.equal(/font-outfit|font-serif/.test(source), false);
    assert.ok(source.includes('page-title'));
  }
  assert.match(read('../src/views/AdminView.tsx'), /className="admin-shell/);
  assert.match(read('../src/views/AdminView.tsx'), /aria-current=\{activeTab === tab/);
});

test('speech uses live description/history once and omits absent or placeholder content', () => {
  assert.equal(speechText(site), 'Real landmark. Database description. Database history');
  assert.equal(speechText({ ...site, shortDescription: '', fullDescription: '', story: '' }), '');
  assert.equal(speechText({ ...site, shortDescription: ' ', fullDescription: '', story: 'No history recorded.' }), '');
  assert.equal(speechText({ ...site, shortDescription: '', fullDescription: 'Long database description.' }), 'Real landmark. Long database description. Database history');
  assert.equal(speechText({ ...site, story: 'Database description.' }), 'Real landmark. Database description');
  assert.equal(player({ ...site, shortDescription: '', fullDescription: '', story: '' }).render(), null);
});

test('Site Detail mounts real-content read aloud near history and keeps verification after visitor info', () => {
  const source = read('../src/views/SiteDetailView.tsx');
  assert.match(source, /<HeritageReadAloud key=\{site.id} site=\{site}/);
  assert.ok(source.indexOf('section-about-place') < source.indexOf('<HeritageReadAloud'));
  assert.ok(source.indexOf('section-the-story') < source.indexOf('<HeritageReadAloud'));
  assert.ok(source.indexOf('<HeritageReadAloud') < source.indexOf('section-timeline'));
  assert.ok(source.indexOf('section-timeline') < source.indexOf('section-site-gallery'));
  assert.ok(source.indexOf('section-visitor-information') < source.indexOf('<VisitVerification'));
});

test('Listen reads real content and Pause/Resume reuse the same utterance', () => {
  const view = player(); view.render(); view.flush();
  assert.equal(view.synthesis.calls.length, 0);
  action(view, 'Listen to heritage story').props.onClick();
  assert.equal(view.synthesis.utterances[0].text, speechText(site));
  assert.equal(view.synthesis.utterances[0].rate, 1);
  assert.equal(action(view, 'Pause reading').props['aria-pressed'], true);
  assert.ok(text(view.render()).includes('Reading heritage story'));
  action(view, 'Pause reading').props.onClick();
  assert.equal(view.synthesis.calls.at(-1), 'pause'); assert.ok(text(view.render()).includes('Paused'));
  action(view, 'Resume reading').props.onClick();
  assert.equal(view.synthesis.calls.at(-1), 'resume'); assert.equal(view.synthesis.utterances.length, 1);
  view.unmount();
});

test('Restart cancels and starts again; Stop cancels; end reports Finished with no fake duration', () => {
  const view = player(); view.render(); view.flush();
  action(view, 'Listen to heritage story').props.onClick();
  const previous = view.synthesis.utterances[0];
  action(view, 'Restart reading from the beginning').props.onClick();
  assert.deepEqual(view.synthesis.calls.slice(-2), ['cancel','speak']);
  assert.notEqual(view.synthesis.utterances[1], previous);
  previous.onend(); assert.ok(text(view.render()).includes('Reading heritage story'));
  view.synthesis.utterances[1].onend(); assert.ok(text(view.render()).includes('Finished'));
  assert.equal(find(view.render(), node => node.type === 'progress'), undefined);
  action(view, 'Listen to heritage story').props.onClick(); action(view, 'Stop reading').props.onClick();
  assert.equal(view.synthesis.calls.at(-1), 'cancel'); assert.ok(text(view.render()).includes('Stopped'));
  assert.equal(action(view, 'Stop reading').props.disabled, true);
  view.unmount();
});

test('speed changes restart paused/active reading with clear status and real supported rates', () => {
  const view = player(); view.render(); view.flush();
  const speeds = find(view.render(), node => node.type === 'select');
  assert.deepEqual(Array.from(speeds.props.children, option => option.props.value), [0.75,1,1.25,1.5]);
  action(view, 'Listen to heritage story').props.onClick(); action(view, 'Pause reading').props.onClick();
  find(view.render(), node => node.type === 'select').props.onChange({ target: { value: '1.25' } });
  assert.equal(view.synthesis.utterances.at(-1).rate, 1.25);
  assert.equal(view.synthesis.paused, false);
  assert.ok(text(view.render()).includes('Restarted from the beginning at the new speed'));
  assert.ok(find(view.render(), node => node.props?.role === 'status'));
  view.unmount();
});

test('unmount, site changes, text changes and removal of text cancel narration', () => {
  const view = player(); view.render(); view.flush(); action(view, 'Listen to heritage story').props.onClick();
  view.render({ ...site, id: '5' }); assert.equal(view.synthesis.calls.at(-1), 'cancel'); view.flush();
  assert.ok(action(view, 'Listen to heritage story')); action(view, 'Listen to heritage story').props.onClick();
  view.render({ ...site, id: '5', story: 'Updated real database history.' }); assert.equal(view.synthesis.calls.at(-1), 'cancel'); view.flush();
  action(view, 'Listen to heritage story').props.onClick();
  assert.equal(view.render({ ...site, shortDescription: '', fullDescription: '', story: '' }), null);
  assert.equal(view.synthesis.calls.at(-1), 'cancel');
  view.render(site); view.flush(); action(view, 'Listen to heritage story').props.onClick(); view.unmount();
  assert.equal(view.synthesis.calls.at(-1), 'cancel');
});

test('unsupported speech or missing utterance constructor offers a safe status and no controls', () => {
  for (const view of [player(site, null), player(site, engine(), { SpeechSynthesisUtterance: undefined })]) {
    const tree = view.render(); view.flush();
    assert.ok(text(tree).includes('Read aloud is not supported in this browser.'));
    assert.equal(find(tree, node => node.type === 'button'), undefined);
    view.unmount();
  }
});

test('speech failures stay local; cancelled callbacks cannot replace current playback state', () => {
  const synthesis = engine(), view = player(site, synthesis); view.render(); view.flush();
  synthesis.speak = () => { throw new Error('private browser error'); };
  assert.doesNotThrow(() => action(view, 'Listen to heritage story').props.onClick());
  assert.ok(text(view.render()).includes('Unable to read aloud')); assert.equal(text(view.render()).includes('private'), false);
  synthesis.speak = utterance => synthesis.utterances.push(utterance);
  action(view, 'Listen to heritage story').props.onClick();
  synthesis.utterances.at(-1).onerror({ error: 'synthesis-failed' });
  assert.ok(find(view.render(), node => node.props?.role === 'alert'));
  action(view, 'Listen to heritage story').props.onClick(); const old = synthesis.utterances.at(-1);
  action(view, 'Restart reading from the beginning').props.onClick(); old.onerror({ error: 'interrupted' });
  assert.ok(text(view.render()).includes('Reading heritage story')); view.unmount();
});

test('old player and unsupported Interactive History are removed; read aloud uses no prototype metadata or QR', () => {
  const source = read('../src/components/HeritageReadAloud.tsx') + read('../src/utils/heritageSpeechText.ts');
  assert.equal(/narrator|durationSeconds|kapampanganTranscript|chapters|audioStory|setInterval|waveform|QR/i.test(source), false);
  assert.equal(existsSync(new URL('../src/components/AudioStoryPlayer.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/views/InteractiveHistoryView.tsx', import.meta.url)), false);
  const walkSource = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walkSource(new URL(entry.name + '/', dir)) : entry.name.endsWith('.tsx') ? [readFileSync(new URL(entry.name, dir), 'utf8')] : []);
  assert.equal(walkSource(new URL('../src/', import.meta.url)).some(source => /font-outfit|AudioStoryPlayer|QRScanner/.test(source)), false);
});
