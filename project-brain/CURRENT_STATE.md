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
- **Production/main:** No production deployment, main merge, or CMS code push was performed for the current CMS work. Local `main` is at `218d180`; local `origin/main` is `ede5c0d` and the local main ref is behind it. No Git fetch of main refs was performed; shared-state synchronization was confined to the docs branch.
- **Resources:** No staging deployment and no production CMS D1, R2, or Access resources have been created. Production configuration was not modified.

## CMS phase status

- **Phase 3A:** Approved and implemented locally.
- **Phase 3B:** Approved and implemented locally.
- **Phase 3C:** **PENDING.** The latest external real-workerd run failed during pre-test cleanup at the test-owned category DELETE, before the new PUT diagnostics could run. Do not begin staging or production work without explicit approval.
- **Latest automated suite:** `node --test tests/*.test.mjs` — **44 passed, 0 failed**. `npm.cmd run build:assets`, relevant `node --check` commands, and `git diff --check` passed. `npm.cmd run build` was attempted but this repository has no `build` script. These do not substitute for external workerd HTTP validation.

## Phase 3C implementation and verified D1 false-conflict fix

The uncommitted local Phase 3C implementation includes migration `0003_release_integrity.sql`; deterministic bilingual snapshots and static rendering; immutable release artifacts and SHA-256 manifests; a resumable publishing pipeline; publication epoch, global content revision, and fencing; atomic activation; rollback and reverse rollback; audit records; report-only garbage-collection reports; JWKS hardening; media protections; and Worker active-release serving.

The latest real-workerd PUT evidence **proves** a false conflict: submitted category revision 1 matched the handler GET revision 1; `conflictBeforeSql=false`; guarded SQL executed successfully; D1 returned `success=true`, `meta.changes=2`; the persisted category revision advanced from 1 to 2 and submitted fields persisted; yet the repository rejected the mutation because it required aggregate `meta.changes === 1`. Migration `0003_release_integrity.sql` defines an AFTER UPDATE category trigger that updates `cms_content_clock`; the count of 2 is consistent with the target category plus this trigger write. The directly established defect is the repository’s reliance on an aggregate change count rather than evidence for the intended row.

**Specific fix:** guarded content UPDATE and DELETE statements retain their `id/page_key/section_key AND revision` predicates and now use `RETURNING` via D1 `.all()`. A mutation is accepted only when D1 reports success and returns exactly the intended target row; UPDATE also verifies revision advanced exactly once. No read-then-unguarded-write or retry was added. API contracts remain unchanged. Diagnostics now classify a genuine zero returned rows separately from an API pre-SQL stale revision or a returned-target/repository interpretation mismatch.

**Guarded mutation audit/fix coverage:**
- `D1ContentStore.save/remove/reorder`: returned target row(s) now prove category/service/gallery/page/settings update, deletion, global content-clock CAS claim/clear, and exact reorder target set. No `meta.changes === 1` decision remains.
- `D1MediaRepository.replace/updateMetadata/archiveUnused`: target media ID and next revision are checked from RETURNING rows. Replacement’s mutation-token guard, variant creation, and token clear are verified within its D1 batch.
- Publishing claim/resume, job/version state changes, lease/fencing renewal, phase changes, release inventory/verification, activation, rollback, and guarded failure-state writes use returned row identity/state, expected epoch, and fencing token checks. Activation and rollback preserve their transaction/batch boundary and compare-and-swap predicates; a batch failure leaves the active pointer unchanged. No aggregate change count decides activation or rollback.
- Non-guarded inserts, audit-only records, snapshot creation, and report-only GC were reviewed separately; they are not treated as optimistic target-row success checks.

**Regression tests:** `tests/cms-content-api.test.mjs` simulates `meta.changes=2` after a current revision UPDATE and DELETE while returning one target row; both succeed, UPDATE advances once, and fields persist. It also verifies stale UPDATE/DELETE return 409 without mutation, no returned target cannot be reported as success, local diagnostics classify outcomes correctly, and public-host/client-toggle isolation remains. Content, media, and publishing Node SQLite adapters simulate trigger-inclusive metadata for DML RETURNING. Existing publishing suites exercise concurrent claims, stale epoch/fence rejection, atomic activation, rollback, reverse rollback, and injected batch failure. Review QR and authorization coverage remains included in the full suite.

**Exact files changed for this D1 interpretation fix:**
- `cms/content/store.mjs`
- `cms/content/api.mjs`
- `cms/media/repository.mjs`
- `cms/publishing/release-pipeline.mjs`
- `tests/cms-content-api.test.mjs`
- `tests/cms-media-api.test.mjs`
- `tests/cms-publishing.test.mjs`

**Automated validation:** `node --test tests/*.test.mjs` — **43 passed, 0 failed**; `npm.cmd run build:assets` passed; `git diff --check` passed; relevant `node --check` commands passed. The requested `npm.cmd run build` reports `Missing script: "build"`; there is no such package script. No test reset, deleted, or re-imported local D1/R2 data. The previous real-workerd PUT did persist revision 2; the local harness uses its test-owned fixture and observes current revisions rather than assuming revision 1.

**Diagnostics:** narrowly scoped server-side local-only PUT/DELETE diagnostics remain temporarily. They require explicitly enabled local auth and diagnostics config, loopback hostname, and the test-owned category identity/anchor. They do not have a client header/query switch or endpoint, do not change API responses, and log no secrets or unrelated content. Diagnostics remain until external workerd validation passes.

**Remaining validation:** Node SQLite RETURNING tests do not prove Wrangler/workerd D1 HTTP runtime behavior. External local workerd validation is still **PENDING**; Phase 3C remains **PENDING**. The local Worker must be restarted to load the new code. No migration, import, database reset, or D1/R2 deletion is required.

**Next external PowerShell commands:** from the repository root, start PowerShell window #1 with:
```powershell
npm.cmd run cms:dev:local
```
Then run window #2:
```powershell
npm.cmd run test:cms:local
```
Keep both outputs, especially any `cms_local_d1_category_put` or `cms_local_d1_category_delete` diagnostic event. The harness must report successful current-revision category UPDATE/DELETE behavior and continue through publish/activation/rollback checks. Do not reset or re-import local D1/R2 data. Phase 3C stays **PENDING** until the real-workerd runtime passes.

## Phase 3C release CSS assertion investigation

**Failure reported by external workerd:** `tests/cms-local-runtime-check.mjs` failed at the assertion “release HTML references versioned CSS.” The external run did not print the response HTML or its stylesheet links, so the exact failing response body was not captured. Inspection and deterministic regression testing identified a Worker release-pointer cache defect that can produce this assertion failure: when the Worker cached an empty active-release pointer before first activation, subsequent requests could reuse that null for up to three seconds and fall through to baseline `ASSETS`, whose homepage CSS is unversioned (`styles.css`). A later activation therefore could be followed by baseline HTML. The prior assertion only reported its message and did not expose observed CSS hrefs.

**Renderer and path comparison:** the renderer generates the same expected versioned URL for English and Chinese:
`/_cms/releases/<release-id>/assets/styles.css`, where `<release-id>` is `release-` plus a UUID. It copies the stylesheet to artifact key `assets/styles.css`; `ReleaseStorage` stores it under `releases/<release-id>/assets/styles.css`; the release manifest records that full key, SHA-256, byte size, `text/css` content type and `asset` kind. The Worker route maps the URL back to that exact R2 key and returns 404 if it is missing; it does not use baseline assets for that versioned URL. Source renderer tests now confirm the exact URL in both languages; publish integration confirms the stylesheet’s manifest/inventory entry and checksum. The CSS URL regex was not simply loosened.

**Fix and coverage:** `worker.mjs` no longer caches an empty active-release pointer, so the next public page request re-reads D1 after first activation. The runtime check now reads the active release ID, waits a bounded five seconds for that exact release page (allowing a prior non-empty pointer’s short cache to expire), and then requires English and Chinese HTML to reference the exact same release CSS URL. It requests CSS over HTTP and checks status 200, `text/css`, and CSS content; it also verifies missing versioned CSS returns 404 without baseline fallback. The Node publish integration asserts CSS exists in the active release’s verified D1 asset inventory and that the stored body hash matches the inventory checksum. Regression coverage reproduces an initial empty pointer followed by activation and confirms both language pages and CSS resolve from the activated release. Existing immutable artifact, manifest verification, publication epoch/fencing, atomic activation/rollback, and Review QR behavior remain in the test suite.

**Files changed for this investigation:**
- `worker.mjs`
- `tests/cms-local-runtime-check.mjs`
- `tests/cms-publishing.test.mjs`

**Validation:** `node --test tests/*.test.mjs` — **44 passed, 0 failed**; `npm.cmd run build:assets` passed; `git diff --check` and relevant `node --check` passed. `npm.cmd run build` was attempted but this package has no `build` script. No real workerd run was performed in the sandbox. The exact prior external HTML that triggered the assertion is unknown because that failed run did not capture its links; the deterministic stale-null-pointer scenario is now covered and fixed.

**Local release-state safety:** the harness preserves local D1/R2 release history. It uses the existing active/previous release as input, creates a fresh uniquely keyed release, checks that release, and rolls back to the immediately previous release. It does not reset, wipe, re-import, or manually alter local D1/R2. Restart the local Worker to load the code change; no migration/import is required.

**Next external local validation:** from the repository root, use PowerShell window #1:
```powershell
npm.cmd run cms:dev:local
```
Then PowerShell window #2:
```powershell
npm.cmd run test:cms:local
```
This is the script name present in the current `package.json` (the reported `test:cms` alias is not defined there). Keep both outputs. Phase 3C remains **PENDING** until this complete real-workerd run succeeds.

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
