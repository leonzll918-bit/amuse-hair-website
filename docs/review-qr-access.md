# Review Assistant QR access

## Architecture and scope

The inspected main commit was `218d180e9618f266b27fdd98bd2d60592fc836cc`.
It contained static HTML/CSS/JS and no Worker script, Wrangler config, package
manifest, Pages Functions, or GitHub Actions workflow. Its successful GitHub
deployment check identified **Workers Builds: amuse-hair-website**, with a
Cloudflare Workers production version. The dashboard's exact build/deploy
command and domain settings were not available from the repository.

This change adds an explicit entry point to that existing website Worker.
`scripts/build-assets.mjs` copies only the existing website assets into `dist/`.
`wrangler.jsonc` binds these static files as `ASSETS`, and runs the Worker
before asset routing. This prevents bypassing the gate through direct HTML,
encoded paths, slashless aliases, or review JavaScript/CSS URLs. Other pages
pass their original requests directly to the asset binding. All existing
website assets and the standalone DeepSeek API remain unchanged.

Reference: [Cloudflare static assets configuration](https://developers.cloudflare.com/workers/static-assets/binding/).

## Authentication

The physical QR URL is `https://amuse.com.my/review/?access=<REVIEW_QR_TOKEN>`.
Replace the placeholder privately when generating/printing the QR. The URL is
a permanent shared salon credential; a photographed/copied URL can be shared.

A valid token creates a stateless HMAC-SHA256 session with a random nonce and
fixed four-hour expiry. The signature also binds the session to its host.
The cookie contains no raw QR token. Its attributes are `HttpOnly; Secure;
SameSite=Lax; Path=/review/; Max-Age=14400`, with a matching `Expires` date.
Expiry is checked by the server even if a client retains the cookie.

The Worker responds with a 303 redirect to clean `/review/` before any HTML
or GA4 loads. All protected responses carry `private, no-store`,
`Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex, nofollow`.
Wrong tokens never create a cookie. Missing or short secrets fail closed with
503; unauthenticated access returns a minimal 403 screen. No Google Review
redirect occurs on denied access.

A short-lived HttpOnly marker causes the Worker to append the GA4 event
`review_qr_access` to the authenticated HTML once, then delete the marker.
Parameters are `entry: qr`, `access_version: v1`, and the clean page location.
No credential or original QR URL is inserted into HTML or analytics.
The marker grants no access. Existing review events and source files are unchanged.

## Manual Cloudflare steps before merging/deployment

1. Open **Workers & Pages → amuse-hair-website → Settings → Variables and Secrets**.
   Add **Secret** bindings (not public plaintext build variables):
   - `REVIEW_QR_TOKEN`: a randomly generated credential of at least 32 characters.
   - `REVIEW_ACCESS_SIGNING_KEY`: an independent random signing key of at least
     32 characters; use at least 32 random bytes, encoded as hex or base64url.
   Generate both privately. Do not paste them into GitHub, source, logs, this
   document, or a chat. Do not reuse the DeepSeek API key.
2. Preserve the existing custom domains/routes, including `amuse.com.my`.
   Confirm the connected Worker is named `amuse-hair-website` and the repository
   root is the build root. This PR does not create another website Worker or
   configure new domain routes.
3. Use the committed Wrangler config. With npm dependency installation enabled,
   the production deploy command should be `npm run deploy` (equivalent to
   `npx wrangler deploy`). Wrangler runs the configured asset-copy build itself;
   no separate dashboard build command is required. Remove an old
   assets-only deployment override such as `--assets .`, if configured, because
   it must not bypass `worker.mjs`. Non-production uploads can use
   `npx wrangler versions upload` after `npm ci`.
4. Before deploying a preview version, ensure it has secret bindings too.
   Without secrets, `/review/` will deliberately deny access with 503, while
   other pages continue working. Avoid printing a QR that targets a preview URL.
5. Review and merge the PR manually. Verify the production build actually deploys
   the Worker entry point and not only the static assets. Purge any existing
   Cloudflare cache for `/review*` if an old cache rule cached the public page;
   ensure no cache rule overrides the new no-store headers.
6. Generate/print the physical QR privately using the final production token.
   Validate the checklist below on `amuse.com.my` before distributing it.

The two secrets belong to **amuse-hair-website**, not
**amuse-review-api**. Keep the standalone API configuration unchanged.

## Local development and validation

Run `npm ci`, `npm test`, and `npm run validate:deploy`.
For local Worker integration tests, create an untracked `.dev.vars` with the
two secret binding names and temporary random values, then run `npm run dev`.
With that server running on port 8787, run `npm run test:integration` to exercise
the real Worker runtime and static asset service.
Do not use the real printed QR credential for development.
Only the explicit website allowlist is copied into `dist/`. `.dev.vars*`,
`.env*`, dependency folders, tests, docs and server source never enter the static
assets. Local secret files and generated directories are also Git-ignored.

Automated tests cover blocked direct requests, wrong/duplicate tokens, clean
redirect and cookie attributes, refresh, signed expiry, tampering, host binding,
aliases/encoded paths, missing secrets, other pages, and one-time analytics.
The real Wrangler runtime should also be used to verify asset routing and
HTMLRewriter before deployment. Local browser checks can verify desktop/mobile
layout, selectors, tags, bilingual response rendering, copy and handoff with
the API mocked. Mocked generation is not evidence of a live DeepSeek result.

## Production acceptance checklist

- New/private browser: `/review/`, `/review/index.html` and a wrong access
  token show the access-required screen, without creating a session cookie.
- Scan the valid QR: cookie is set, URL becomes clean `/review/`, the existing
  Review Assistant loads, and GA4 receives no token or secret URL.
- Refresh: access persists; after four hours, access is denied again.
- Generate actual English and Chinese drafts against the existing API, edit,
  copy, and verify the Google Review handoff. Do not post a test review.
- Check mobile flow and unrelated English/Chinese website pages.
- Verify `/review/` remains noindex and absent from sitemap/navigation.
- Check the successful deployment's version and secrets, and repeat the gate
  checks on any alternate website hostname in use.

Production authentication and live bilingual API generation must be confirmed
after secrets are configured and the PR is deployed. This PR must not be merged
automatically.

## Validation performed for this PR

- Ten Node tests passed; Worker, asset build and existing review JS syntax passed.
- Real Wrangler runtime checks passed for direct/wrong/valid access, static and
  encoded aliases, secure cookie flags, clean redirect, refresh, signed expired
  cookies and tampering, and one-time HTMLRewriter analytics.
- Unrelated pages and authenticated review JS/CSS matched source byte-for-byte.
  Internal source, config, docs, tests and local credentials returned 404.
- Wrangler deployment dry-run succeeded with 39 website assets; no deployment
  was performed by the dry-run.
- Playwright browser validation confirmed automatic clean-URL authentication,
  service and dynamic tag selection, English and Chinese draft rendering using
  a mocked review API, copy success, existing generation/copy event parameters,
  the one-time QR event, and a mobile viewport of 390 × 844. The Google Review
  handoff opened Google's Maps/sign-in flow; no review was posted.
- Existing review HTML/CSS/JS and all other original website files were not
  edited. Production secrets and the live DeepSeek API were not accessed.
