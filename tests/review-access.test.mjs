import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker from '../worker.mjs';

// Ephemeral test credentials only. Production credentials never enter source.
const qr = randomBytes(32).toString('hex');
const signing = randomBytes(32).toString('hex');
const origin = 'https://amuse.com.my';
const sessionName = '__Secure-amuse_review_access';
let assetCalls = [];
const env = {
  REVIEW_QR_TOKEN: qr,
  REVIEW_ACCESS_SIGNING_KEY: signing,
  ASSETS: { async fetch(request) {
    assetCalls.push(request);
    return new Response('<html><body>Review Assistant</body></html>', {
      headers: { 'Content-Type': 'text/html', 'X-Asset-Header': 'preserved' },
    });
  } },
};
const request = (path = '/review/', cookie, method = 'GET') => new Request(origin + path, {
  method, headers: cookie ? { Cookie: cookie } : {},
});
async function authenticate() {
  const response = await worker.fetch(request(`/review/?access=${qr}`), env);
  const cookies = response.headers.getSetCookie();
  return { response, cookies, cookie: cookies.map(c => c.split(';')[0]).join('; ') };
}
function signedCookie(issued, expires, host = 'amuse.com.my') {
  const payload = `v1.${issued}.${expires}.${randomBytes(16).toString('base64url')}`;
  const signature = createHmac('sha256', signing).update(`${host}\n${payload}`).digest('base64url');
  return `${sessionName}=${payload}.${signature}`;
}

test('direct access denies HTML and never fetches the protected asset', async () => {
  assetCalls = [];
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 403);
  assert.match(await response.text(), /Please scan the QR code/);
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(assetCalls.length, 0);
});

test('wrong, empty and duplicate tokens cannot create a cookie', async () => {
  for (const path of ['/review/?access=WRONG_TOKEN', '/review/?access=', `/review/?access=${qr}&access=${qr}`]) {
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.ok(!(await response.text()).includes(qr));
  }
});

test('QR creates an opaque signed four-hour session and clean redirect', async () => {
  const { response, cookies } = await authenticate();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/review/');
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) {
    assert.match(cookie, /Path=\/review\/; HttpOnly; Secure; SameSite=Lax/);
    assert.ok(!cookie.includes(qr));
    assert.ok(!cookie.includes(signing));
  }
  assert.match(cookies[0], /Max-Age=14400; Expires=/);
});

test('valid cookie survives refresh; all review assets remain accessible', async () => {
  const { cookies } = await authenticate();
  const cookie = cookies[0].split(';')[0];
  for (const path of ['/review/', '/review/index.html', '/review/review.js', '/review/review.css', '/review/']) {
    const response = await worker.fetch(request(path, cookie), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Asset-Header'), 'preserved');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  }
});

test('expired and forged sessions are rejected server-side', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { cookies } = await authenticate();
  const cookie = cookies[0].split(';')[0];
  for (const value of [signedCookie(now - 14400, now), signedCookie(now + 60, now + 14460),
    signedCookie(now, now + 28800), signedCookie(now, now + 14400, 'preview.workers.dev'),
    cookie.replace('v1.', 'v2.'), cookie.replace(/.$/, '!'), `${sessionName}=invalid`,
    `${cookie}; ${cookie}`]) {
    assert.equal((await worker.fetch(request('/review/', value), env)).status, 403);
  }
});

test('direct HTML aliases, encoded paths and static files cannot bypass the gate', async () => {
  for (const path of ['/review', '/review.html', '/review/index', '/review/index.html',
    '/%72eview/', '/%2572eview/', '//review/index.html', '/review%2findex.html',
    '/foo%2f..%2freview%2findex.html', '/REVIEW/', '/review/review.js', '/review/review.css']) {
    assert.equal((await worker.fetch(request(path), env)).status, 403, path);
  }
});

test('missing secrets fail closed; unsupported methods and HEAD do not expose HTML', async () => {
  for (const overrides of [{ REVIEW_QR_TOKEN: undefined }, { REVIEW_ACCESS_SIGNING_KEY: undefined },
    { REVIEW_ACCESS_SIGNING_KEY: 'short' }]) {
    assert.equal((await worker.fetch(request(), { ...env, ...overrides })).status, 503);
  }
  assert.equal((await worker.fetch(request('/review/', null, 'POST'), env)).status, 405);
  assert.equal(await (await worker.fetch(request('/review/', null, 'HEAD'), env)).text(), '');
});

test('other pages pass the original request unchanged without any access configuration', async () => {
  for (const path of ['/', '/services/hair-colour/', '/zh/', '/gallery/', '/styles.css', '/reviewing/']) {
    const original = request(path);
    const response = await worker.fetch(original, { ASSETS: env.ASSETS });
    assert.equal(response.status, 200);
    assert.equal(assetCalls.at(-1), original);
    assert.equal(response.headers.get('Cache-Control'), null);
    assert.equal(response.headers.get('Set-Cookie'), null);
  }
});

test('optional QR analytics is emitted only on authenticated clean HTML', async () => {
  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = class {
    on(selector, handler) { this.handler = handler; assert.equal(selector, 'body'); return this; }
    transform(response) {
      this.handler.element({ append: (html) => {
        assert.match(html, /review_qr_access/);
        assert.match(html, /entry:'qr',access_version:'v1'/);
        assert.ok(!html.includes(qr));
        assert.ok(!html.includes(signing));
      } });
      return response;
    }
  };
  try {
    const { cookie, cookies } = await authenticate();
    const response = await worker.fetch(request('/review/', cookie), env);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Set-Cookie'), /qr_entry=;.*Max-Age=0/);
    const refresh = await worker.fetch(request('/review/', cookies[0].split(';')[0]), env);
    assert.equal(refresh.headers.get('Set-Cookie'), null);
  } finally { globalThis.HTMLRewriter = previous; }
});

test('existing review source preserves bilingual/API/handoff/tracking contracts and noindex', () => {
  const html = readFileSync(new URL('../review/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../review/review.js', import.meta.url), 'utf8');
  assert.match(html, /noindex,follow/);
  assert.match(html, /data-language="en"/);
  assert.match(html, /data-language="zh"/);
  assert.match(html, /https:\/\/g\.page\/r\/CdTPuN2LebNNEBM\/review/);
  assert.match(js, /https:\/\/amuse-review-api\.abbylim1116\.workers\.dev/);
  for (const name of ['review_generate', 'review_copy', 'review_google_open', 'review_private_feedback']) {
    assert.ok(js.includes(name));
  }
  assert.ok(!readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8').includes('/review/'));
});
