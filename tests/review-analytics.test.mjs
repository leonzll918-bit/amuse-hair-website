import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const reviewScript = await readFile(new URL('../review/review.js', import.meta.url), 'utf8');
const reviewHtml = await readFile(new URL('../review/index.html', import.meta.url), 'utf8');

function element(dataset = {}) {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  return {
    dataset,
    listeners,
    attributes,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
    },
    addEventListener(name, callback) { listeners.set(name, callback); },
    async click() { return listeners.get('click')?.({ preventDefault() {} }); },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    scrollIntoView() {},
    focus() {},
    select() {},
    children: [],
    appendChild(child) { this.children.push(child); },
  };
}

function makeHarness(responses = []) {
  const events = [];
  const requests = [];
  const serviceParent = element({ value: 'Basic Color' });
  const alternativeServiceParent = element({ value: 'Hair Treatment' });
  const serviceCategory = { querySelectorAll: () => [] };
  serviceParent.closest = () => serviceCategory;
  alternativeServiceParent.closest = () => serviceCategory;
  const stars = Array.from({ length: 5 }, (_, index) => element({ value: String(index + 1) }));
  const tags = ['Loved the result', 'Good consultation', 'Friendly stylist']
    .map((value) => element({ value }));
  const stylists = ['Abby', 'Alvin', 'May'].map((value) => element({ value }));
  stylists.forEach((button) => button.setAttribute('aria-pressed', 'false'));
  const languages = ['en', 'zh'].map((language) => element({ language }));
  const privateFeedback = element();
  const byId = new Map([
    ['service-tag-panel', { hidden: true }],
    ['service-specific-tags', { innerHTML: '', children: [], appendChild(child) { this.children.push(child); } }],
    ['stylist-label', { textContent: 'Stylist (optional)' }],
    ['draft-panel', { hidden: true, scrollIntoView() {} }],
    ['draft-title', { textContent: '' }],
    ['review-draft', { value: '', focus() {}, select() {} }],
    ['copy-review', element()],
    ['copy-status', { textContent: '' }],
    ['generation-status', { textContent: '' }],
    ['open-google', element()],
    ['private-feedback', privateFeedback],
  ]);
  const document = {
    querySelectorAll(selector) {
      return new Map([
        ['.service-parent', [serviceParent, alternativeServiceParent]],
        ['.service-child', []],
        ['.service-expand', []],
        ['[data-group="rating"] .star', stars],
        ['[data-group="general-tags"] .tag', tags],
        ['.language-button', languages],
        ['.stylist-choice', stylists],
      ]).get(selector) ?? [];
    },
    getElementById(id) { return byId.get(id); },
    createElement() { return element(); },
  };
  const context = {
    document,
    window: {
      location: { pathname: '/review/' },
      gtag(_command, name, params) { events.push({ name, params }); },
    },
    navigator: { clipboard: { async writeText(text) { context.copied.push(text); } } },
    fetch: async (url, options) => {
      requests.push({ url, options, payload: JSON.parse(options.body) });
      const next = responses.shift() ?? { ok: true, status: 200, body: { review: 'A natural, happy review.' } };
      return { ok: next.ok, status: next.status ?? (next.ok ? 200 : 500), async json() { return next.body; } };
    },
    console: { error() {} },
    copied: [],
  };
  vm.runInNewContext(reviewScript, context, { filename: 'review.js' });
  const click = async (target) => target.click();
  const prepare = async () => {
    await click(serviceParent);
    await click(stars[4]);
  };
  const generate = async (language = 'en') => click(languages.find((button) => button.dataset.language === language));
  return { events, requests, stylists, languages, tags, stars, serviceParent, alternativeServiceParent, byId, click, prepare, generate, context };
}

const names = (harness) => harness.events.map(({ name }) => name);
const eventParams = (harness, name) => harness.events.filter((event) => event.name === name).map((event) => event.params);

test('successful initial generation is not a regeneration; later successful generations each are', async () => {
  const h = makeHarness([
    { ok: true, body: { review: 'First draft.' } },
    { ok: true, body: { review: 'Second draft.' } },
    { ok: true, body: { review: 'Third draft.' } },
  ]);
  await h.prepare();
  await h.generate();
  assert.deepEqual(names(h), ['review_generate']);
  await h.generate();
  assert.deepEqual(names(h), ['review_generate', 'review_generate', 'review_regenerate']);
  await h.generate();
  assert.deepEqual(names(h), ['review_generate', 'review_generate', 'review_regenerate', 'review_generate', 'review_regenerate']);
});

test('failed regeneration preserves the baseline and edit state without a regenerate event', async () => {
  const h = makeHarness([
    { ok: true, body: { review: 'Original draft.' } },
    { ok: false, status: 503, body: { error: 'Unavailable' } },
  ]);
  await h.prepare();
  await h.generate();
  h.byId.get('review-draft').value = 'Edited original draft.';
  await h.click(h.byId.get('copy-review'));
  await h.generate('zh');
  await h.click(h.byId.get('open-google'));
  assert.deepEqual(names(h), ['review_generate', 'review_edited', 'review_copy', 'review_google_open']);
  assert.equal(h.byId.get('review-draft').value, 'Edited original draft.');
  assert.equal(eventParams(h, 'review_edited')[0].language, 'en');
  assert.equal(eventParams(h, 'review_copy')[0].language, 'en');
  assert.equal(eventParams(h, 'review_google_open')[0].services, 'Basic Color');
  assert.equal(eventParams(h, 'review_google_open')[0].rating, 5);
  assert.equal(h.requests.length, 2);
});

test('Copy after a failed Chinese regeneration keeps the original English draft context', async () => {
  const h = makeHarness([
    { ok: true, body: { review: 'Original English draft.' } },
    { ok: false, status: 503, body: { error: 'Unavailable' } },
  ]);
  await h.prepare();
  await h.generate('en');
  await h.generate('zh');
  await h.click(h.byId.get('copy-review'));
  assert.equal(h.byId.get('review-draft').value, 'Original English draft.');
  assert.deepEqual(names(h), ['review_generate', 'review_copy']);
  assert.deepEqual(
    { ...eventParams(h, 'review_copy')[0] },
    { page_path: '/review/', services: 'Basic Color', service_count: 1, rating: 5, language: 'en' },
  );
});

test('Copy and Google Open use the successful draft context after unsaved service/rating changes', async () => {
  const h = makeHarness([{ ok: true, body: { review: 'Draft for context A.' } }]);
  await h.prepare();
  await h.generate('en');

  await h.click(h.serviceParent);
  await h.click(h.alternativeServiceParent);
  await h.click(h.stars[2]);
  await h.click(h.byId.get('copy-review'));
  await h.click(h.byId.get('open-google'));

  const expected = { services: 'Basic Color', service_count: 1, rating: 5, language: 'en' };
  for (const eventName of ['review_copy', 'review_google_open']) {
    const params = eventParams(h, eventName)[0];
    for (const [key, value] of Object.entries(expected)) assert.equal(params[key], value);
    assert.notEqual(params.services, 'Hair Treatment');
    assert.notEqual(params.rating, 3);
  }
  assert.equal(eventParams(h, 'review_generate')[0].services, 'Basic Color');
});

test('unchanged and whitespace-only Copy do not report an edit; changed text reports once across Copy and Google', async () => {
  const h = makeHarness([{ ok: true, body: { review: 'Exact generated text.' } }]);
  await h.prepare();
  await h.generate();
  h.byId.get('review-draft').value = '  Exact generated text.  ';
  await h.click(h.byId.get('copy-review'));
  assert.deepEqual(names(h), ['review_generate', 'review_copy']);
  h.byId.get('review-draft').value = 'Customer-edited text.';
  await h.click(h.byId.get('copy-review'));
  await h.click(h.byId.get('open-google'));
  assert.deepEqual(names(h), ['review_generate', 'review_copy', 'review_edited', 'review_copy', 'review_google_open']);
});

test('edited Google Open reports an edit before the Google event', async () => {
  const h = makeHarness([{ ok: true, body: { review: 'Original.' } }]);
  await h.prepare();
  await h.generate();
  h.byId.get('review-draft').value = 'Edited before Google.';
  await h.click(h.byId.get('open-google'));
  assert.deepEqual(names(h), ['review_generate', 'review_edited', 'review_google_open']);
});

test('regeneration replaces the baseline, resets edit reporting, and abandoned edits are not counted', async () => {
  const h = makeHarness([
    { ok: true, body: { review: 'First.' } },
    { ok: true, body: { review: 'Second.' } },
  ]);
  await h.prepare();
  await h.generate();
  h.byId.get('review-draft').value = 'Edited first but abandoned.';
  await h.generate();
  assert.equal(h.byId.get('review-draft').value, 'Second.');
  await h.click(h.byId.get('copy-review'));
  h.byId.get('review-draft').value = 'Edited second.';
  await h.click(h.byId.get('open-google'));
  assert.deepEqual(names(h), ['review_generate', 'review_generate', 'review_regenerate', 'review_copy', 'review_edited', 'review_google_open']);
});

test('no stylist is selected by default and review generation omits an unselected stylist', async () => {
  const h = makeHarness([{ ok: true, body: { review: 'No stylist review.' } }]);
  assert.deepEqual(h.stylists.map((button) => button.getAttribute('aria-pressed')), ['false', 'false', 'false']);
  await h.prepare();
  await h.generate();
  assert.equal(h.requests[0].payload.services[0], 'Basic Color');
  assert.equal(h.requests[0].payload.rating, 5);
  assert.equal(Object.hasOwn(h.requests[0].payload, 'stylist'), false);
  assert.deepEqual(names(h), ['review_generate']);
});

test('each optional stylist selection is sent exactly and remains exclusive', async () => {
  for (const stylist of ['Abby', 'Alvin', 'May']) {
    const h = makeHarness([{ ok: true, body: { review: 'Generated.' } }]);
    await h.prepare();
    await h.click(h.stylists.find((button) => button.dataset.value === stylist));
    assert.deepEqual(h.stylists.map((button) => button.getAttribute('aria-pressed')), ['Abby', 'Alvin', 'May'].map((name) => String(name === stylist)));
    await h.generate();
    assert.equal(h.requests[0].payload.stylist, stylist);
    assert.deepEqual(names(h), ['review_generate']);
    for (const params of h.events.map((event) => event.params)) assert.equal(Object.hasOwn(params, 'stylist'), false);
    assert.ok(!JSON.stringify(h.events).includes(stylist));
  }
});

test('changing stylist applies to the next generation and regeneration keeps the current selection', async () => {
  const h = makeHarness([
    { ok: true, body: { review: 'Abby draft.' } },
    { ok: true, body: { review: 'May draft.' } },
  ]);
  await h.prepare();
  await h.click(h.stylists[0]);
  await h.generate();
  await h.click(h.stylists[2]);
  await h.generate();
  assert.deepEqual(h.requests.map((request) => request.payload.stylist), ['Abby', 'May']);
  assert.deepEqual(names(h), ['review_generate', 'review_generate', 'review_regenerate']);
  assert.equal(h.byId.get('review-draft').value, 'May draft.');
});

test('Chinese generation switches the optional stylist label without translating names', async () => {
  const h = makeHarness([{ ok: true, body: { review: '中文草稿。' } }]);
  assert.equal(h.byId.get('stylist-label').textContent, 'Stylist (optional)');
  await h.prepare();
  await h.click(h.stylists[1]);
  await h.generate('zh');
  assert.equal(h.byId.get('stylist-label').textContent, '发型师（可选）');
  assert.equal(h.requests[0].payload.stylist, 'Alvin');
  assert.match(reviewHtml, /data-value="Abby"[^>]*>Abby/);
  assert.match(reviewHtml, /data-value="Alvin"[^>]*>Alvin/);
  assert.match(reviewHtml, /data-value="May"[^>]*>May/);
  assert.match(reviewHtml, /class="choice stylist-choice" data-value="Abby" aria-pressed="false"/);
  assert.doesNotMatch(reviewHtml.match(/id="stylist-options"[\s\S]*?<\/div>/)?.[0] ?? '', /is-selected/);
});

test('existing events retain safe parameters and no analytics event receives review content or stylist', async () => {
  const generatedReview = 'Sensitive customer-authored review text.';
  const h = makeHarness([{ ok: true, body: { review: generatedReview } }]);
  await h.prepare();
  await h.click(h.tags[0]);
  await h.click(h.stylists[0]);
  await h.generate();
  h.byId.get('review-draft').value = `${generatedReview} Edited.`;
  await h.click(h.byId.get('copy-review'));
  await h.click(h.byId.get('open-google'));
  await h.click(h.byId.get('private-feedback'));
  assert.deepEqual(names(h), ['review_generate', 'review_edited', 'review_copy', 'review_google_open', 'review_private_feedback']);
  assert.equal(eventParams(h, 'review_generate')[0].generator, 'deepseek');
  assert.equal(eventParams(h, 'review_copy').length, 1);
  assert.equal(eventParams(h, 'review_google_open').length, 1);
  const serializedEvents = JSON.stringify(h.events);
  assert.ok(!serializedEvents.includes(generatedReview));
  assert.ok(!serializedEvents.includes('Abby'));
  assert.ok(h.events.every(({ params }) => !Object.hasOwn(params, 'review')));
  assert.deepEqual(h.requests[0].payload.experience_tags, ['Loved the result']);
  assert.equal(Object.hasOwn(h.requests[0].payload, 'tags'), false);
  assert.equal(h.requests[0].payload.rating, 5);
  assert.deepEqual(h.requests[0].payload.services, ['Basic Color']);
});

test('failed initial generation does not create a baseline or report regeneration/edit events', async () => {
  const h = makeHarness([{ ok: false, status: 503, body: { error: 'Unavailable' } }]);
  await h.prepare();
  await h.generate();
  h.byId.get('review-draft').value = 'Manually entered.';
  await h.click(h.byId.get('copy-review'));
  await h.click(h.byId.get('open-google'));
  assert.deepEqual(names(h), ['review_copy', 'review_google_open']);
});
