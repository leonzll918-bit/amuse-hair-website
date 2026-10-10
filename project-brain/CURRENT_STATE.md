# Amuse Hair Studio — Current Project State

Last updated: 2026-10-10 Asia/Singapore.

This file is the concise shared status for ChatGPT ↔ Codex handoffs. It records
verified evidence separately from pending checks and planned work. It is not a
replacement for the detailed CMS architecture/security audit or the Amuse SEO
Operating Protocol.

## Project and Git state

- **Project:** Amuse Hair Studio official website and CMS.
- **Repository:** `amuse-hair-website`.
- **Verified local branch:** `codex/amuse-cms-phase-2`.
- **Verified local HEAD:** `fbe81df0827a5604b7466d97e10f2864c21df78f` (`Remove temporary review configuration diagnostics`).
- **Working tree:** CMS implementation and related files are uncommitted. The shared `project-brain/` and `.agents/` directories are also untracked. No CMS implementation is included in a commit.
- **Production/main:** No production deployment, main merge, or push was performed for the current CMS work. Local `main` is at `218d180`; local `origin/main` is `ede5c0d` and the local main ref is behind it. No remote fetch was performed for this update.
- **Resources:** No staging deployment and no production CMS D1, R2, or Access resources have been created. Production configuration was not modified.

## CMS phase status

- **Phase 3A:** Approved and implemented locally.
- **Phase 3B:** Approved and implemented locally.
- **Phase 3C:** **PENDING.** The latest external real-workerd run failed during category PUT; the full real-workerd runtime gate has not passed. Do not begin staging or production work without explicit approval.
- **Latest automated suite:** `node --test tests/*.test.mjs` — **43 passed, 0 failed**. `npm.cmd run build:assets`, relevant `node --check` commands, and `git diff --check` passed. `npm.cmd run build` was also attempted but this repository has no `build` script. These do not substitute for external workerd HTTP validation.

## Phase 3C local implementation recorded

The uncommitted local implementation includes migration `0003_release_integrity.sql`; deterministic bilingual snapshots and static rendering; immutable release artifacts and SHA-256 manifests; a resumable publishing pipeline; publication epoch, global content revision, and fencing; atomic activation; rollback and reverse rollback; audit records; report-only garbage-collection reports; JWKS size/refresh hardening; media revision/reuse protections; and Worker active-release serving.

The local profile measured a synthetic 12 MP image at approximately **4.4 seconds elapsed, 4.3 seconds CPU, and 335.8 MiB peak RSS**. This is a **local Node/Photon measurement only**; it does not establish Cloudflare Workers compatibility. Image processing capacity remains a staging gate. Production upload limits were not changed.

## External workerd failure and latest investigation

**Latest external evidence (user-run real workerd):** `POST /api/cms/categories` created `category-92e60182-60d9-470a-a785-8a5757b36873` with `revision=1`. The following request was `PUT /api/cms/categories/category-92e60182-60d9-470a-a785-8a5757b36873`; it expected HTTP 200, sent `revision=1` (same as the created revision), and received HTTP 409 `{"error":"revision_conflict"}`. The runtime test derives the sent revision from its pre-PUT category GET/list, so that read also returned 1. The API’s separate internal GET immediately before its revision comparison was not instrumented. This PUT failure supersedes the previous category DELETE failure as the latest result.

**Root cause:** **not yet proven.** The user-provided result establishes create revision 1 and submitted revision 1; the test harness sources the submitted revision from its pre-PUT GET, which also returned 1. It does not establish what the API’s own internal GET observed, the D1 result metadata from the attempted UPDATE, or whether the stored row changed. The API can produce this 409 either when its internal current revision differs from the submitted value or when the guarded UPDATE returns unsuccessful metadata / a change count other than one. The exact failing branch, SQL row effect, and persisted revision after failure remain unknown. No evidence establishes a Node/SQLite versus real workerd D1 semantic difference. No evidence establishes multiple Worker instances or multiple local D1 databases; the instance/database topology for that run is unknown.

**Verified source contract and exact generated category UPDATE:** the handler first reads the current category and returns 409 if the submitted integer revision differs. If equal, `D1ContentStore.save` runs this category statement (bound values omitted):

```sql
UPDATE cms_service_categories
SET anchor = ?, name_en = ?, name_zh = ?, sort_order = ?, visible = ?, content_status = ?,
    revision = revision + 1, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND revision = ?
```

The adapter then checks `result.success` and `result.meta?.changes === 1`; if either check fails it returns null, which the API maps to 409. On success it performs a GET and returns the saved row. **Observed real D1 mutation result shape/metadata:** not supplied. **Whether the SQL changed the row:** not observed; do not infer from the HTTP response alone, because 409 is returned both before SQL and after an unsuccessful guarded update. Category creation returned revision 1, and the harness’s pre-PUT read also yielded revision 1; the API’s internal pre-update GET and any post-failure GET were not reported.

**Implementation/test changes already present locally:** the category PUT handler and `D1ContentStore.save` now collect the local-only revision/mutation evidence described below without changing public API responses or normal mutation behavior. `tests/cms-local-runtime-check.mjs` re-reads the category before editing, submits that revision, asserts PUT increments it, checks stale DELETE returns 409, re-reads before current-revision DELETE, and prints safe request context on assertion failure. `tests/cms-content-api.test.mjs` exercises diagnostic output, A/B/C/D classifications with test doubles, public-host and client-toggle isolation, and unchanged response contracts. Earlier runtime harness changes still handle existing local release state and check that failed publish leaves the active release/page unchanged. These automated tests use Node’s SQLite-backed adapter; they do not establish real-workerd HTTP behavior. No authorization, revision, epoch, fencing, or other security guard was weakened.

**Local-only D1 diagnostics implemented:** modified files are `cms/content/api.mjs`, `cms/content/store.mjs`, `wrangler.cms.local.jsonc`, `tests/cms-local-runtime-check.mjs`, and `tests/cms-content-api.test.mjs`. The Worker emits a server-side JSON console record for the test-owned `runtime-check` category PUT. It includes category ID, submitted and handler-observed revisions, pre-SQL conflict flag, whether `.run()` was invoked, D1 `success`, `meta.changes`, allowlisted scalar metadata and SQL duration, repository interpretation, post-operation revision, changed-field persistence booleans, and classification. No content values, authorization tokens, or other request data are logged. The API response body/status contract is unchanged.

Diagnostics require **all** of: `CMS_LOCAL_AUTH="true"`, `CMS_D1_DIAGNOSTICS="true"`, a loopback request hostname (`127.0.0.1`, `localhost`, or `::1`), and the test category anchor/ID shape. The diagnostics flag exists only in `wrangler.cms.local.jsonc`; the local dev script explicitly enables local auth. A client header/query value cannot enable logging, and public hostnames do not log even if a client supplies those values. No diagnostic endpoint or production Worker logging switch was added. Test-only context diagnostics remain in the local HTTP runtime helper.

The diagnostic classifications are: **A** API pre-update revision mismatch (SQL not executed); **B** D1 reports a successful mutation/fields and revision are persisted, but repository metadata interpretation returned conflict; **C** D1 reports success with zero changes and no attempted field change persisted; **D** other or inconclusive outcomes. A successful update is recorded separately as `update_succeeded`.

**D1 result semantics:** repository code currently requires `result.success === true` and `result.meta.changes === 1`. The Node SQLite test adapter wraps `node:sqlite`’s `changes` as numeric `meta.changes` and `success: true`; Cloudflare’s documented D1 result likewise specifies boolean `success` and numeric `meta.changes`. This source/documentation comparison does **not** prove runtime parity. The actual workerd result metadata and whether its SQL changed the row remain unobserved; no semantic mismatch or root cause is proven.

**Automated validation:** `node --test tests/*.test.mjs` — **43 passed, 0 failed**; `npm.cmd run build:assets` passed; `node --check` passed for `cms/content/api.mjs`, `cms/content/store.mjs`, `tests/cms-content-api.test.mjs`, and `tests/cms-local-runtime-check.mjs`; `git diff --check` passed. `npm.cmd run build` was attempted and reported `Missing script: "build"`; the repository’s existing asset build script was used instead. The real-workerd HTTP rerun is still required.

### Real HTTP/workerd coverage status

Across reported runs, baseline English/Chinese pages, Admin local-authorized access, CMS source/config exclusion, Review QR denial, D1 reads, category creation, and the previously attempted category DELETE path have been exercised; the latest run failed earlier at category PUT after POST revision 1. Treat only the latest run’s sequence as current. Later media/R2, preview, publish, activation, rollback, and post-rollback HTTP checks remain pending.

**Sandbox runtime attempt:** `npm.cmd run cms:dev:local` did not start workerd here. Wrangler 4.147.0 failed while bundling with `Cannot read directory "../../../../..": Access is denied` and also could not write its log under `C:\Users\abbyl\.wrangler\logs` (`EPERM`). No security restrictions were bypassed. No local HTTP/workerd validation is claimed.

**Next external local commands:** restart the local server so it loads the diagnostic flag and code. In PowerShell window #1, from the repository root, run `npm.cmd run cms:dev:local`. In PowerShell window #2, run `npm.cmd run test:cms:local`. Inspect window #1 for the structured `cms_local_d1_category_put` console record; the test runner in window #2 still reports the unchanged HTTP response and request context. No migration or content import is required for these code/config changes; do not reset or wipe local D1/R2. If the PUT still returns 409, preserve both outputs so the API’s internal observed revision, actual D1 result metadata, post-operation revision, and field-persistence classification can be assessed. Run only against the local loopback server. Phase 3C remains **PENDING** until the full real-workerd runtime validation passes.

## Verified architecture and security decisions

- Keep the public website static/release-based and preserve its existing English/Chinese routes, design, responsive behavior, and SEO output.
- Cloudflare Access is an outer gate; Admin/CMS mutations also require server-side Access JWT verification, an active D1 admin allowlist entry, and same-origin checks. Do not add custom username/password authentication.
- Keep originals, drafts, and unpublished previews private. Only optimized, immutable, content-addressed derivatives intended for publication may enter the public derivative namespace. The accepted short pre-activation visibility window for those public marketing derivatives remains accepted.
- Publish through **Draft → Validate → Build → Verify → Activate**. Activation uses the expected global content revision, publication epoch, fencing token, verified manifest, and complete object inventory. Failed candidates must leave the active release unchanged.
- Roll back to a verified known-good release and keep rollback reversible. Review QR protection runs before release serving. Serve baseline `ASSETS` before first activation; do not mix missing active-release pages with baseline content after activation.
- Begin garbage collection in report-only mode with a grace period and reference recheck. Keep staging and production resources isolated.
- The intended eventual image delivery architecture is `media.amuse.com.my` → dedicated public R2 bucket → immutable optimized WebP derivatives. No bucket or hostname exists yet.

Detailed architecture reference: `AMUSE_CMS_ARCHITECTURE_AUDIT_2026-10-06.md`. That filename was not present in this repository scan; consult the existing audit wherever it is maintained rather than duplicating it here.

## SEO / GEO status (preserved baseline)

- **Confirmed baseline from the SEO Operating Protocol:** Hair Colour is the first commercial priority and measurement-phase page. Hair Treatment standalone page creation remains paused unless approved.
- **Missing:** Current GSC, GA4, GBP, lead, booking, and revenue evidence is not available in this checkout.
- **Missing:** No systematic AI visibility baseline or third-party citation audit has been completed in this initialization.
- **Next SEO/GEO action:** Confirm official GBP and social profile URLs, then record a dated GEO entity/source and AI visibility baseline. Keep observations distinct from approved facts in `BUSINESS_GROUND_TRUTH.md`.

## Shared Brain / Handoff Protocol

After each meaningful Amuse implementation, bug fix, architecture/security review, test gate, phase completion, staging change, or production change, Codex updates this shared-state document. Each update includes the timestamp, phase/task, files or components affected, exact tests/results, unresolved issues, security/architecture decisions, Git branch/status, deployment/resource status, and the exact recommended next action.

Label statements **VERIFIED**, **PENDING**, or **PLANNED** as appropriate. Never report planned work as completed. Keep detailed architecture in its authoritative audit and link to it rather than copying it here. Never include secrets, tokens, credentials, Access assertions, signing keys, or `.dev.vars` values.

When syncing this document to GitHub while implementation remains unfinished, isolate the documentation change on a separate documentation branch and commit only `project-brain/CURRENT_STATE.md`. Do not merge to `main`, and verify the staged file list before committing or pushing. Production deployment still requires separate explicit approval.
