# Amuse Hair Studio — Current Project State

Last updated: 2026-10-07 23:51 Asia/Singapore.

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
- **Phase 3C:** Local implementation is in review; it is **not formally complete or approved** because the external real-workerd runtime gate failed and has not yet passed after the focused test-harness changes. Do not begin staging or production work without explicit approval.
- **Latest automated suite:** `node --test tests/*.test.mjs` — **42 passed, 0 failed**. `npm.cmd run build:assets`, relevant `node --check` commands, and `git diff --check` also passed. These do not substitute for external workerd HTTP validation.

## Phase 3C local implementation recorded

The uncommitted local implementation includes migration `0003_release_integrity.sql`; deterministic bilingual snapshots and static rendering; immutable release artifacts and SHA-256 manifests; a resumable publishing pipeline; publication epoch, global content revision, and fencing; atomic activation; rollback and reverse rollback; audit records; report-only garbage-collection reports; JWKS size/refresh hardening; media revision/reuse protections; and Worker active-release serving.

The local profile measured a synthetic 12 MP image at approximately **4.4 seconds elapsed, 4.3 seconds CPU, and 335.8 MiB peak RSS**. This is a **local Node/Photon measurement only**; it does not establish Cloudflare Workers compatibility. Image processing capacity remains a staging gate. Production upload limits were not changed.

## External workerd failure and latest investigation

The reported failure was at `tests/cms-local-runtime-check.mjs:66` in the then-current test: an edit of the category just created by that test returned HTTP 409 where HTTP 200 was expected. The request was `PUT /api/cms/categories/{test-category-id}` with bilingual name, the same `runtime-check` anchor, visibility/order fields, and the revision returned by category creation. CRUD requests do not send a publication epoch or fencing token.

**Verified from source:** the category `PUT` handler returns `{"error":"revision_conflict"}` if the supplied row revision is stale or if the guarded D1 update does not affect exactly one row. The same test assertion did not print the 409 response body or the revision value, so the actual body and which of those two guards fired are **not verified**. The failure occurred before media or publishing operations, so publication epoch, fencing, duplicate publish state, and media association are not implicated. No implementation defect has been confirmed; do not represent the runtime failure as fully diagnosed.

**Latest focused test fix:** `tests/cms-local-runtime-check.mjs` now re-reads its own category before editing, submits the current row revision, and reports method, path, expected/actual status, safe response body, and relevant revisions on failure. The runtime harness also handles an existing active local release, uses a uniquely marked validation fixture, and checks that an invalid publish leaves the active pointer and served homepage unchanged. `tests/cms-content-api.test.mjs` adds category-update coverage. No revision, epoch, fencing, authorization, or other security guard was weakened.

The runtime harness cleans only identified test-owned records; it does not wipe the local CMS database. Successful previous runs may leave release history in local D1/R2 emulation; subsequent runs account for an already-active release. The focused runtime changes have **not yet been exercised by real workerd**.

### Real HTTP/workerd coverage status

The failed external run reached and passed earlier checks for baseline English/Chinese pages, Admin local-authorized access, CMS source/config exclusion, Review QR denial, D1 reads, and category creation, then stopped at the category update. That run did **not** reach media/R2 or publish/rollback HTTP checks.

The updated test script is designed to exercise D1 CRUD, local media/R2 upload and thumbnail, private preview, publish-time validation failure, build/verification/activation through the publish endpoint, idempotent retry, active release and versioned asset serving, rollback and post-rollback serving, Review QR precedence, and private manifest/source exclusion. This coverage is **pending an external rerun**. Local loopback mode exercises authorized Admin/API requests; unauthenticated Access behavior is covered by automated tests, not by the loopback-authenticated workerd run.

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
