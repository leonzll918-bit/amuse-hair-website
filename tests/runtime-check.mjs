// Start `npm run dev` with ephemeral .dev.vars first. Never prints credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';

const base = 'http://127.0.0.1:8787';
const vars = Object.fromEntries(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
  .trim().split('\n').map(line => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1).trim()];
  }));
const qr = vars.REVIEW_QR_TOKEN;
const fetchPage = (path, cookie) => fetch(base + path, {
  redirect: 'manual', headers: cookie ? { Cookie: cookie } : {},
});

for (const path of ['/review/', '/review', '/review.html', '/review/index.html',
  '/review/index', '/%72eview/', '/%2572eview/', '//review/index.html', '/review%2findex.html',
  '/review/review.js', '/review/review.css', '/review/?access=WRONG_TOKEN']) {
  const response = await fetchPage(path);
  assert.equal(response.status, 403, path);
  assert.equal(response.headers.get('Set-Cookie'), null, path);
  assert.match(await response.text(), /Please scan the QR code/);
}
console.log('PASS: actual asset routing blocks direct, wrong-token and alias requests');

const auth = await fetchPage(`/review/?access=${qr}`);
assert.equal(auth.status, 303);
assert.equal(auth.headers.get('Location'), '/review/');
const cookies = auth.headers.getSetCookie();
assert.equal(cookies.length, 2);
assert.match(cookies[0], /HttpOnly; Secure; SameSite=Lax; Max-Age=14400/);
assert.ok(!cookies.join('').includes(qr));
const cookie = cookies.map(value => value.split(';')[0]).join('; ');
const clean = await fetchPage('/review/', cookie);
assert.equal(clean.status, 200);
assert.equal(clean.headers.get('Cache-Control'), 'private, no-store');
const html = await clean.text();
assert.match(html, /id="service-specific-tags"/);
assert.match(html, /review_qr_access/);
assert.ok(!html.includes(qr));
assert.match(clean.headers.get('Set-Cookie'), /qr_entry=;.*Max-Age=0/);
const session = cookies[0].split(';')[0];
const refresh = await fetchPage('/review/', session);
assert.equal(refresh.status, 200);
assert.ok(!(await refresh.text()).includes('review_qr_access'));
for (const path of ['/review/review.js', '/review/review.css']) {
  const response = await fetchPage(path, session);
  assert.equal(response.status, 200, path);
  assert.equal(await response.text(), readFileSync(new URL('..' + path, import.meta.url), 'utf8'));
}
console.log('PASS: real HMAC redirect/cookie, HTMLRewriter analytics, refresh and unchanged review assets');

const now = Math.floor(Date.now() / 1000);
const payload = `v1.${now - 14400}.${now}.${randomBytes(16).toString('base64url')}`;
const signature = createHmac('sha256', vars.REVIEW_ACCESS_SIGNING_KEY)
  .update(`127.0.0.1:8787\n${payload}`).digest('base64url');
assert.equal((await fetchPage('/review/', `__Secure-amuse_review_access=${payload}.${signature}`)).status, 403);
const tampered = session.slice(0, -10) + (session.at(-10) === 'A' ? 'B' : 'A') + session.slice(-9);
assert.equal((await fetchPage('/review/', tampered)).status, 403);
console.log('PASS: actual runtime rejects signed expired and tampered sessions');

for (const path of ['/', '/zh/', '/services/hair-colour/', '/styles.css']) {
  const response = await fetchPage(path);
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get('Set-Cookie'), null);
  const file = path.endsWith('/') ? path + 'index.html' : path;
  assert.equal(await response.text(), readFileSync(new URL('..' + file, import.meta.url), 'utf8'));
}
for (const path of ['/worker.mjs', '/wrangler.jsonc', '/package.json', '/package-lock.json',
  '/.dev.vars', '/tests/review-access.test.mjs', '/docs/review-qr-access.md']) {
  assert.equal((await fetchPage(path)).status, 404, path);
}
console.log('PASS: other pages unchanged; server code/config/test credentials excluded from static assets');
