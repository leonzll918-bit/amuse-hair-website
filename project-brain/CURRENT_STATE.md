# Amuse Hair Studio — Current Project State

Last updated: 2026-10-08 00:20 Asia/Singapore.

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
- **Latest automated suite:** `node --test tests/*.test.mjs` — **42 passed, 0 failed**. `npm.cmd run build:assets`, syntax checks for the two focused test files, and `git diff --check` also passed. These do not substitute for external workerd HTTP validation.

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

**Implementation/test changes already present locally:** no CMS server implementation change was made for this follow-up. `tests/cms-local-runtime-check.mjs` re-reads the category before editing, submits the read revision, asserts the PUT response increments revision by one, checks a stale DELETE returns 409, re-reads before current-revision DELETE, and includes revisions plus the response body in failure diagnostics. `tests/cms-content-api.test.mjs` covers create → update → stale delete 409 → current delete 200, including the reorder revision advance. The earlier local test harness change also handles existing local release state and checks failed publish leaves the active release/page unchanged. These focused tests pass on Node’s SQLite-backed adapter; that does not prove workerd D1 behavior. No authorization, revision, epoch, or fencing guard was weakened.

**Diagnostics:** failure-context diagnostics remain in the local runtime test helper and include method/path, expected/actual status, response body, and supplied revision context. There is no temporary logging or diagnostic change to Worker production code. The latest failure context reported the method/path, expected/actual status, response `{"error":"revision_conflict"}`, submitted revision 1, and created revision 1. It does not log the API’s internal GET result, D1 `run()` metadata, or a post-failure row read.

**Automated validation:** `node --test tests/*.test.mjs` — **42 passed, 0 failed**; `npm.cmd run build:assets` passed; syntax checks for `tests/cms-local-runtime-check.mjs` and `tests/cms-content-api.test.mjs` passed; `git diff --check` passed. The real-workerd HTTP rerun is still required.

### Real HTTP/workerd coverage status

Across reported runs, baseline English/Chinese pages, Admin local-authorized access, CMS source/config exclusion, Review QR denial, D1 reads, category creation, and the previously attempted category DELETE path have been exercised; the latest run failed earlier at category PUT after POST revision 1. Treat only the latest run’s sequence as current. Later media/R2, preview, publish, activation, rollback, and post-rollback HTTP checks remain pending.

**Next external command:** with local Wrangler still running in PowerShell window #1, rerun `npm.cmd run test:cms:local` in PowerShell window #2. The test helper now prints revision context and response body on assertion failure. If PUT still returns 409, the next diagnostic must capture a GET of the test category immediately after POST and before PUT, plus the exact D1 `run()` result metadata and whether a subsequent GET shows the row changed. Do not deploy or point this command at production. Phase 3C remains **PENDING** until the full real-workerd runtime validation passes.

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
