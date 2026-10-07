# Amuse Hair Studio — Current Project State

Last updated: 2026-10-08 Asia/Singapore.

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
- **Latest automated suite:** `node --test tests/*.test.mjs` — **42 passed, 0 failed**. `npm.cmd run build:assets`, syntax checks for the two focused test files, and `git diff --check` also passed. These do not substitute for external workerd HTTP validation.

## Phase 3C local implementation recorded

The uncommitted local implementation includes migration `0003_release_integrity.sql`; deterministic bilingual snapshots and static rendering; immutable release artifacts and SHA-256 manifests; a resumable publishing pipeline; publication epoch, global content revision, and fencing; atomic activation; rollback and reverse rollback; audit records; report-only garbage-collection reports; JWKS size/refresh hardening; media revision/reuse protections; and Worker active-release serving.

The local profile measured a synthetic 12 MP image at approximately **4.4 seconds elapsed, 4.3 seconds CPU, and 335.8 MiB peak RSS**. This is a **local Node/Photon measurement only**; it does not establish Cloudflare Workers compatibility. Image processing capacity remains a staging gate. Production upload limits were not changed.

## External workerd failure and latest investigation

The latest external real-workerd rerun passed the earlier category update check but then stopped on category deletion with HTTP 409 and `{"error":"revision_conflict"}`. The reported failure location was the category DELETE path in `tests/cms-local-runtime-check.mjs`. The external result did not include the category revision returned by the preceding update, the revision sent in DELETE, or a fresh read of the row at failure time. Therefore the precise stale value and why it differed are **not verified**. Source tracing found no category-row trigger that increments its revision as a side effect of unrelated service/media changes; the global content clock is separate. No server implementation defect is established by the evidence currently available.

**Verified contract:** category creation starts at revision 1; a successful category update increments the row revision by one and returns the saved row. Deletion is guarded by `WHERE id = ? AND revision = ?`; the API returns `revision_conflict` for a stale revision or when the guarded delete does not affect exactly one row. Category CRUD does not use publication epochs or fencing tokens.

**Latest focused test changes:** `tests/cms-local-runtime-check.mjs` asserts that update returns the incremented revision, deliberately verifies that DELETE with the pre-update revision returns 409, then re-reads the category and uses that current revision for deletion. Cleanup also re-reads before deleting and prints creation, post-update, current, and submitted revisions if deletion fails. `tests/cms-content-api.test.mjs` covers create → update/current revision → stale delete 409 → current delete 200, including a reorder-induced revision advance. No revision, epoch, fencing, authorization, or other security guard was weakened. These focused tests pass under Node’s local SQLite-backed test setup; this does not establish real-workerd HTTP behavior.

The runtime harness cleans only identified test-owned records; it does not wipe the local CMS database. Successful previous runs may leave release history in local D1/R2 emulation; subsequent runs account for an already-active release. The revised category deletion path has **not yet passed a subsequent real-workerd rerun**.

### Real HTTP/workerd coverage status

The latest external rerun passed the prior category update check and then stopped at category deletion. Earlier baseline English/Chinese pages, Admin local-authorized access, CMS source/config exclusion, Review QR denial, D1 reads, and category create/update checks have passed across the reported runs. This latest run did **not** reach later media/R2 or publish/rollback HTTP checks.

The updated test script is designed to exercise D1 CRUD, local media/R2 upload and thumbnail, private preview, publish-time validation failure, build/verification/activation through the publish endpoint, idempotent retry, active release and versioned asset serving, rollback and post-rollback serving, Review QR precedence, and private manifest/source exclusion. Category DELETE and all later runtime checks are **pending another external rerun**. Local loopback mode exercises authorized Admin/API requests; unauthenticated Access behavior is covered by automated tests, not by the loopback-authenticated workerd run.

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
