import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const reviewScript = await readFile(new URL('../review/review.js', import.meta.url), 'utf8');
const reviewCss = await readFile(new URL('../review/review.css', import.meta.url), 'utf8');

function element(dataset = {}) {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  return {
    dataset,
    listeners,
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

function makeHarness() {
  const requests = [];
  const hairColourParent = element({ value: 'Hair Colour' });
  const basicColorChild = element({ value: 'Basic Color' });
  const hairTreatmentParent = element({ value: 'Hair Treatment' });
  const hairColourCategory = {
    querySelectorAll(selector) { return selector === '.service-child' ? [basicColorChild] : []; },
    querySelector(selector) {
      if (selector === '.service-parent') return hairColourParent;
      return null;
    },
  };
  const hairTreatmentCategory = {
    querySelectorAll: () => [],
    querySelector: (selector) => selector === '.service-parent' ? hairTreatmentParent : null,
  };
  hairColourParent.closest = () => hairColourCategory;
  basicColorChild.closest = () => hairColourCategory;
  hairTreatmentParent.closest = () => hairTreatmentCategory;

  const stars = Array.from({ length: 5 }, (_, index) => element({ value: String(index + 1) }));
  const languages = ['en', 'zh'].map((language) => element({ language }));
  const grid = { innerHTML: '', children: [], appendChild(child) { this.children.push(child); } };
  const byId = new Map([
    ['service-tag-panel', { hidden: true }],
    ['service-specific-tags', grid],
    ['stylist-label', { textContent: 'Stylist (optional)' }],
    ['draft-panel', { hidden: true, scrollIntoView() {} }],
    ['draft-title', { textContent: '' }],
    ['review-draft', { value: '' }],
    ['copy-review', element()],
    ['copy-status', { textContent: '' }],
    ['generation-status', { textContent: '' }],
    ['open-google', element()],
    ['private-feedback', element()],
  ]);
  const document = {
    querySelectorAll(selector) {
      return new Map([
        ['.service-parent', [hairColourParent, hairTreatmentParent]],
        ['.service-child', [basicColorChild]],
        ['.service-expand', []],
        ['[data-group="rating"] .star', stars],
        ['[data-group="general-tags"] .tag', []],
        ['.language-button', languages],
        ['.stylist-choice', []],
      ]).get(selector) ?? [];
    },
    getElementById(id) { return byId.get(id); },
    createElement() { return element(); },
  };
  const context = {
    document,
    window: { location: { pathname: '/review/' }, gtag() {} },
    navigator: { clipboard: { async writeText() {} } },
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, status: 200, async json() { return { review: 'Test draft.' }; } };
    },
    console: { error() {} },
  };
  vm.runInNewContext(reviewScript, context, { filename: 'review.js' });
  const generate = async () => languages.find((button) => button.dataset.language === 'en').click();
  const chooseRating = async () => stars[4].click();
  return { hairColourParent, basicColorChild, hairTreatmentParent, byId, requests, generate, chooseRating };
}

test('parent service toggles selected state and service state from Hair Colour to empty', async () => {
  const h = makeHarness();
  assert.equal(h.hairColourParent.classList.contains('is-selected'), false);
  await h.chooseRating();

  await h.hairColourParent.click();
  assert.equal(h.hairColourParent.classList.contains('is-selected'), true);
  await h.generate();
  assert.deepEqual(h.requests[0].services, ['Hair Colour']);

  await h.hairColourParent.click();
  assert.equal(h.hairColourParent.classList.contains('is-selected'), false);
  await h.generate();
  assert.equal(h.requests.length, 1);
  assert.match(h.byId.get('generation-status').textContent, /choose at least one service/i);
});

test('child service toggles selected state and service state from Basic Color to empty', async () => {
  const h = makeHarness();
  assert.equal(h.basicColorChild.classList.contains('is-selected'), false);
  await h.chooseRating();

  await h.basicColorChild.click();
  assert.equal(h.basicColorChild.classList.contains('is-selected'), true);
  assert.equal(h.hairColourParent.classList.contains('is-selected'), false);
  await h.generate();
  assert.deepEqual(h.requests[0].services, ['Basic Color']);

  await h.basicColorChild.click();
  assert.equal(h.basicColorChild.classList.contains('is-selected'), false);
  await h.generate();
  assert.equal(h.requests.length, 1);
  assert.match(h.byId.get('generation-status').textContent, /choose at least one service/i);
});

test('selecting a child deselects its parent, and selecting the parent clears selected children', async () => {
  const h = makeHarness();
  await h.hairColourParent.click();
  assert.equal(h.hairColourParent.classList.contains('is-selected'), true);

  await h.basicColorChild.click();
  assert.equal(h.hairColourParent.classList.contains('is-selected'), false);
  assert.equal(h.basicColorChild.classList.contains('is-selected'), true);

  await h.hairColourParent.click();
  assert.equal(h.hairColourParent.classList.contains('is-selected'), true);
  assert.equal(h.basicColorChild.classList.contains('is-selected'), false);
});

test('deselecting an incorrect service allows the intended service to be selected alone', async () => {
  const h = makeHarness();
  await h.chooseRating();
  await h.basicColorChild.click();
  await h.basicColorChild.click();
  assert.equal(h.basicColorChild.classList.contains('is-selected'), false);

  await h.hairTreatmentParent.click();
  assert.equal(h.hairTreatmentParent.classList.contains('is-selected'), true);
  await h.generate();
  assert.deepEqual(h.requests[0].services, ['Hair Treatment']);
});

test('selected choices stay styled independently of hover, which is limited to hover-capable devices', () => {
  assert.match(reviewCss, /\.choice\.is-selected\{[^}]*border-color:#111[^}]*background:#111[^}]*color:#fff\}/);
  const hoverMediaIndex = reviewCss.indexOf('@media (hover:hover) and (pointer:fine)');
  assert.notEqual(hoverMediaIndex, -1);
  const hoverOnlyRules = reviewCss.slice(hoverMediaIndex);
  assert.match(hoverOnlyRules, /\.choice:hover\{/);
  assert.ok(hoverOnlyRules.includes('.service-expand:hover'));
  assert.ok(hoverOnlyRules.includes('.star:hover'));
  assert.ok(hoverOnlyRules.includes('.button:hover'));
  assert.doesNotMatch(reviewCss.replace(hoverOnlyRules, ''), /:hover/);
});
