const SESSION_SECONDS = 4 * 60 * 60;
const SESSION_COOKIE = '__Secure-amuse_review_access';
const ENTRY_COOKIE = '__Secure-amuse_review_qr_entry';
const encoder = new TextEncoder();
const cookieFlags = 'Path=/review/; HttpOnly; Secure; SameSite=Lax';

function protectedPath(pathname) {
  // Asset routing can normalize encoded paths. Always run this gate first,
  // including for /review/index.html and encoded or slashless aliases.
  let path = pathname;
  for (let i = 0; i < 8; i++) {
    try {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    } catch { break; }
  }
  path = path.replaceAll('\\', '/').replace(/\/{2,}/g, '/');
  path = new URL(`https://assets.invalid${path}`).pathname.toLowerCase();
  return path === '/review' || path === '/review.html' || path.startsWith('/review/');
}

function secureHeaders(headers = new Headers()) {
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

function blocked(request, status = 403, env) {
  const headers = secureHeaders();
  if (status === 503) {
    headers.set('X-Review-QR-Type', typeof env.REVIEW_QR_TOKEN);
    headers.set('X-Review-QR-Length', String(env.REVIEW_QR_TOKEN ?? '').length);
    headers.set('X-Review-Signing-Type', typeof env.REVIEW_ACCESS_SIGNING_KEY);
    headers.set('X-Review-Signing-Length', String(env.REVIEW_ACCESS_SIGNING_KEY ?? '').length);
  }
  headers.set('Content-Type', 'text/html; charset=utf-8');
  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Review Assistant | Amuse Hair Studio</title>
<style>body{margin:0;background:#faf8f5;color:#151515;font-family:Arial,sans-serif}main{box-sizing:border-box;width:min(760px,calc(100% - 24px));margin:40px auto;padding:32px;background:#fff;border:1px solid #e8e2dc;border-radius:24px;box-shadow:0 14px 50px rgba(0,0,0,.05)}.brand{text-transform:uppercase;letter-spacing:.14em;font-size:.8rem}h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(2.6rem,7vw,4.6rem);line-height:1.05}p{line-height:1.7;color:#4e4a46}@media(max-width:620px){main{margin:16px auto;padding:24px 18px;border-radius:18px}}</style>
</head><body><main><div class="brand">Amuse Hair Studio</div><h1>Review Assistant</h1>
<p>Please scan the QR code at Amuse Hair Studio to access this page.</p></main></body></html>`;
  return new Response(request.method === 'HEAD' ? null : html, { status, headers });
}

function readCookie(request, name) {
  const values = (request.headers.get('Cookie') || '').split(';')
    .map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : null;
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  try {
    return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='), c => c.charCodeAt(0));
  } catch { return null; }
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function validQrToken(candidate, expected) {
  if (candidate.length > 4096) return false;
  // Compare fixed-size digests without an early exit based on secret bytes.
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const actual = new Uint8Array(actualHash);
  const wanted = new Uint8Array(expectedHash);
  let difference = 0;
  for (let i = 0; i < wanted.length; i++) difference |= actual[i] ^ wanted[i];
  return difference === 0;
}

async function createSession(key, host, now) {
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v1.${now}.${now + SESSION_SECONDS}.${nonce}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${host}\n${payload}`));
  return `${payload}.${toBase64Url(signature)}`;
}

async function validSession(value, key, host, now) {
  if (!value || value.length > 256) return false;
  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1' || !/^\d{1,12}$/.test(parts[1]) ||
      !/^\d{1,12}$/.test(parts[2]) || !/^[A-Za-z0-9_-]{22}$/.test(parts[3])) return false;
  const issued = Number(parts[1]);
  const expires = Number(parts[2]);
  if (issued > now || expires <= now || expires - issued !== SESSION_SECONDS) return false;
  const signature = fromBase64Url(parts[4]);
  if (!signature) return false;
  return crypto.subtle.verify('HMAC', key, signature,
    encoder.encode(`${host}\n${parts.slice(0, 4).join('.')}`));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!protectedPath(url.pathname)) return env.ASSETS.fetch(request);
    if (!['GET', 'HEAD'].includes(request.method)) return blocked(request, 405);
    // A missing or invalid configuration must never expose the static page.
    if (typeof env.REVIEW_QR_TOKEN !== 'string' || env.REVIEW_QR_TOKEN.length < 32 ||
        typeof env.REVIEW_ACCESS_SIGNING_KEY !== 'string' || env.REVIEW_ACCESS_SIGNING_KEY.length < 32) {
      return blocked(request, 503, env);
    }
    const key = await signingKey(env.REVIEW_ACCESS_SIGNING_KEY);
    const now = Math.floor(Date.now() / 1000);
    if (url.searchParams.has('access')) {
      const tokens = url.searchParams.getAll('access');
      if (tokens.length !== 1 || !await validQrToken(tokens[0], env.REVIEW_QR_TOKEN)) {
        return blocked(request);
      }
      const session = await createSession(key, url.host, now);
      const headers = secureHeaders();
      headers.set('Location', '/review/');
      headers.append('Set-Cookie', `${SESSION_COOKIE}=${session}; ${cookieFlags}; Max-Age=${SESSION_SECONDS}; Expires=${new Date((now + SESSION_SECONDS) * 1000).toUTCString()}`);
      // This marker contains no credential and is consumed on the clean HTML.
      headers.append('Set-Cookie', `${ENTRY_COOKIE}=1; ${cookieFlags}; Max-Age=60`);
      return new Response(null, { status: 303, headers });
    }
    if (!await validSession(readCookie(request, SESSION_COOKIE), key, url.host, now)) {
      return blocked(request);
    }
    // The access query never reaches asset serving or client-side analytics.
    const asset = await env.ASSETS.fetch(request);
    let response = new Response(asset.body, { status: asset.status, statusText: asset.statusText,
      headers: secureHeaders(new Headers(asset.headers)) });
    if (request.method === 'GET' && asset.status === 200 &&
        asset.headers.get('Content-Type')?.includes('text/html') &&
        readCookie(request, ENTRY_COOKIE) === '1') {
      response = new HTMLRewriter().on('body', {
        element(element) {
          element.append(`<script>if(typeof window.gtag==='function'){window.gtag('event','review_qr_access',{entry:'qr',access_version:'v1',page_location:window.location.origin+'/review/'});}</script>`, { html: true });
        },
      }).transform(response);
      response.headers.append('Set-Cookie', `${ENTRY_COOKIE}=; ${cookieFlags}; Max-Age=0`);
    }
    return response;
  },
};
