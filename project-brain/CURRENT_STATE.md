# Amuse Hair Studio — Current Project State

Last updated: 2026-10-11 Asia/Singapore.

This file is the concise shared status for ChatGPT ↔ Codex handoffs. It records
verified evidence separately from pending checks and planned work. It is not a
replacement for the detailed CMS architecture/security audit or the Amuse SEO
Operating Protocol.

## Project and Git state

- **Project:** Amuse Hair Studio official website and CMS.
- **Repository:** `amuse-hair-website`.
- **Verified local branch:** `codex/amuse-cms-phase-2`.
- **Verified local HEAD:** `fbe81df0827a5604b7466d97e10f2864c21df78f` (`Remove temporary review configuration diagnostics`).
- **Working tree:** CMS implementation and related files remain uncommitted; pre-review status was preserved. Shared-state documentation is maintained separately on docs/amuse-cms-shared-state. No CMS implementation is included in a commit.
- **Production/main:** No production deployment, main merge, or CMS code push was performed for the current CMS work. Local `main` is at `218d180`; local `origin/main` is `ede5c0d` and the local main ref is behind it. No Git fetch of main refs was performed; shared-state synchronization was confined to the docs branch.
- **Resources:** No staging deployment and no production CMS D1, R2, or Access resources have been created. Production configuration was not modified.

## CMS phase status

- **Phase 3A:** Approved and implemented locally.
- **Phase 3B:** Approved and implemented locally.
- **Phase 3C:** **Scoped security re-review PASS — recommendation A: APPROVE local implementation.** User reports 4 consecutive successful post-fix real local workerd HTTP runs. Automated suite 49/49 and deterministic state-comparison checks passed. Awaiting user final phase sign-off; staging and production remain unauthorized.
- **Latest automated suite:** `node --test tests/*.test.mjs` — **49 passed, 0 failed** after the focused F1–F6 fixes. `npm.cmd run build:assets`, relevant `node --check` commands, and `git diff --check` passed. No real workerd HTTP run was performed in this correction pass.

Historical D1/CSS and correction sections below retain earlier evidence and commands. Their pending-runtime/blocking statements are superseded by the final scoped re-review at the end of this document, including 4 consecutive user-reported post-fix workerd passes.

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

## Final Phase 3C read-only review — 2026-10-11

**Recommendation: C — BLOCK final local approval pending specific corrections. Phase 3C remains PENDING.** Staging is not authorized or ready; production is not authorized. Four successful local HTTP runs do not override reproduced concurrency failures.

### Evidence and validation

- **USER-REPORTED external evidence:** the complete real local workerd runtime test passed **4 times total, including 3 consecutive recent passes**. No external workerd rerun was performed by this review. The previous category RETURNING blockers and CSS assertion no longer fail in those reported runs.
- **VERIFIED in this review:** unchanged automated suite: `node --test tests/*.test.mjs` — **44 passed, 0 failed**, exit 0. Relevant `node --check` commands passed for Worker, publishing pipeline/API/renderer, content store, media repository, and HTTP harness. `git diff --check` passed (only existing LF/CRLF advisory warnings).
- Additional read-only experiments executed the actual release-pipeline functions using the existing Node SQLite D1 adapter and fresh **in-memory databases only**. No durable local D1/R2 was accessed, reset, imported or altered. These are deterministic interleaving reproductions, not Cloudflare/workerd results and not new committed regression tests.
- No implementation files were edited; no build, deployment, migration or import was run. Only this documentation is changed.
- Source/working tree: `codex/amuse-cms-phase-2`, HEAD `fbe81df0827a5604b7466d97e10f2864c21df78f`; existing uncommitted CMS files unchanged by review. Local main remains `218d180e9618f266b27fdd98bd2d60592fc836cc`. No tracked .env/.dev.vars files were returned by Git; both patterns are ignored.

### Findings

No CRITICAL finding was established. Findings below distinguish observed defects from deployment-readiness risks.

**F1 — HIGH: stale inventory writer can alter an already activated release's D1 inventory.**
- File/function: `cms/publishing/release-pipeline.mjs:128-150`, `writeReleaseInventory`.
- Evidence: fence validation is a separate awaited operation; the later batch unconditionally DELETEs/inserts inventory before guarded job/version updates. In-memory reproduction activated the same job between fence validation and the inventory batch. The call threw `release_inventory_write_failed`, but the active verified release's inventory increased to **2 objects while expected_object_count remained 1**. A separate stolen-fence reproduction likewise persisted a new inventory object after rejection.
- Scenario/impact: a same-idempotency-key concurrent request can share the current job/fence, complete activation, then have its verified inventory overwritten by the delayed request. Lease takeover is another stale-writer route. Immutable R2 bytes were not overwritten in this reproduction, but verified inventory/retention and future activation/rollback consistency are compromised.
- Blocks local approval: **YES**. Blocks staging: **YES**.
- Correction: make every inventory write conditional on the same current slot/job/fence/lease/building-state ownership inside its transaction; ensure a failed guard makes the entire transition a no-op or aborts it. Protect verified/activated inventory from mutation and add these exact interleaving tests. A JavaScript throw after batch completion is insufficient.

**F2 — HIGH: rejected expired-job resume commits destructive side effects.**
- File/function: `cms/publishing/release-pipeline.mjs:29-48`, expired-lease branch of `createPublishJob`.
- Evidence: only the first batch statement checks slot CAS, source revision and publication epoch. Job/version resets and inventory DELETE are not dependent on claim success. Reproduction: build inventory, expire lease, increment content clock, retry same key. Result: `publish_job_not_resumable`; **slot fence remained 1, job fence became 2/phase claimed, inventory count became 0**.
- Scenario/impact: a normal content edit before retry, or another contender winning the claim, causes rejected recovery to damage the candidate and leave job/slot inconsistent. Under activation interleaving the unconditional inventory deletion can also affect a release completed by another request.
- Blocks local approval: **YES**. Blocks staging: **YES**.
- Correction: gate every resume statement on the successful claim's unique ownership/transition marker, or abort the whole batch if claim fails; preserve old inventory/state on rejected resume.

**F3 — HIGH: rollback losing CAS still invalidates a publisher.**
- File/function: `cms/publishing/release-pipeline.mjs:248-280`, `rollbackPublishedRelease`, especially job-stale UPDATE at line 276.
- Evidence: pointer/audit/version/slot writes use transition_id, but the job-stale UPDATE does not. Reproduction changed publication_epoch during awaited storage verification, so pointer CAS failed. Function threw `Release changed before rollback could activate`, yet the building job became **stale / rollback_invalidated**, and its slot remained claimed.
- Scenario/impact: concurrent publish/rollback or competing rollback wins the epoch race; losing rollback unexpectedly cancels another publish and leaves stale-job lease state.
- Blocks local approval: **YES**. Blocks staging: **YES**.
- Correction: gate stale-job invalidation on this rollback's successful transition_id within the same batch; test losing rollback is a no-op for all state, not only the active pointer.

**F4 — MEDIUM: local published owner-upload URLs use a nonexistent route.**
- File/function: `wrangler.cms.local.jsonc:27`; `ReleaseStorage.publishMediaVariant` in `cms/publishing/storage.mjs`; `releaseRequest` in `worker.mjs:20`.
- Evidence: configured base is `http://127.0.0.1:8787/__cms/public-media` (two underscores), whereas Worker matches `/_cms/public-media` (one). Read-only Worker simulation with a present public object returned **404 for configured prefix**, **200 for supported prefix**. The runtime harness archives its uploaded-media fixture before publishing, so its PASS does not cover published owner uploads.
- Scenario/impact: publish a visible Gallery/Hair Colour item using owner-upload media; HTML references a URL that falls through to ASSETS.
- Blocks local approval: **YES**, functional publish gap. Blocks staging: **YES until staging delivery base is correctly configured and end-to-end tested**; this local typo alone does not prove an external R2 hostname fails.
- Correction: align local base with actual route and add upload → associate → publish → public image GET coverage; staging must use its own public derivative delivery endpoint.

**F5 — MEDIUM: release CSP blocks the preserved inline GA initialization.**
- File/function: `cms/publishing/api.mjs:97-103`, `serveReleaseObject`; inline initialization retained by renderer from `index.html:19` and `zh/index.html:19`.
- Evidence: script-src permits self and googletagmanager but has no nonce/hash/inline allowance; rendered templates retain inline dataLayer/gtag configuration. Browser CSP semantics block that inline bootstrap. This is source/policy evidence; browser telemetry was not run in this review.
- Scenario/impact: baseline GA configuration/CTA measurement stops initializing on activated pages despite successful HTML/CSS HTTP checks.
- Blocks local approval: **YES**, required existing-site behavior preservation. Blocks staging acceptance: **YES**.
- Correction: authorize only the known bootstrap with a matching CSP hash or move it to a trusted versioned external script; retain strong CSP. Add browser-level GA/CTA initialization regression coverage.

**F6 — MEDIUM: publication/audit actor is silently lost.**
- File/function: `cms/auth/authorize.mjs:46` returns identity.subject; `cms/publishing/api.mjs:22,45,54,85-86`, `handleCmsPublishingApi`, reads identity.sub.
- Evidence: actual local authorization returned `{subject:"local-test-owner",email:"owner@local.test"}`; publication actor expression evaluated to undefined/null. Direct publishing tests pass `{sub:"owner"}`, masking the real router contract.
- Scenario/impact: authenticated publishing, rollback, snapshots and GC audit records omit the administrator identity. Authentication itself remains enforced; this is an accountability defect.
- Blocks local approval: **NO independently**. Blocks staging acceptance: **YES**.
- Correction: use the canonical subject field consistently and test the complete authorized router-to-publishing path with non-null audit actors.

**F7 — MEDIUM: image resource suitability remains unproven (staging gate).**
- File/function: `cms/media/image-processor.mjs`, `processUploadedImage/toVariant`; `scripts/cms/profile-image.mjs`.
- Evidence: accepts up to 12 MP / 15 MiB and synchronously decodes/resizes/encodes three WASM variants. Local tests establish function, not Workers resource compliance. Earlier reported Node RSS/CPU profiling is not an isolate-memory measurement. Current Cloudflare documentation specifies 128 MB per isolate including WASM, Free CPU 10 ms, Paid default 30 seconds (configurable up to 5 minutes).
- Scenario/impact: large or concurrent authenticated uploads may exhaust isolate memory/CPU; actual hosted failure is **not proven**.
- Blocks local approval: **NO independently**. Blocks staging readiness for image processing: **YES until a safe plan and limits are validated**.
- Correction: select/verify the staging plan, measure realistic worst-case image processing and concurrent load, and reduce limits or isolate/offload processing if needed. Paid CPU does not raise the memory ceiling.

**F8 — LOW: interrupted HTTP harness can leave a non-fixture draft edited.**
- File/function: `tests/cms-local-runtime-check.mjs:213-221`, top-level parking-note mutation/restoration.
- Evidence: writes existing parking_note to Local runtime update, then restores its saved value only after second publish and rollback succeed; no finally restoration surrounds that section.
- Scenario/impact: failure/interruption before restoration leaves a changed local draft; next run can capture that changed value as its baseline. Successful runs restore the saved draft, while release history intentionally accumulates.
- Blocks local approval: **NO independently**. Blocks staging: **NO; this loopback-only harness must not target staging**.
- Correction: use robust guarded restoration/recovery tracking or a disposable test-owned content fixture, without wiping data or overwriting a concurrent editor. Do not equate repeatable PASS with zero durable side effects.

**F9 — LOW: original first-run CSS failure has incomplete forensic evidence.**
- File/function: `worker.mjs:33-40`, active-pointer cache; `tests/cms-local-runtime-check.mjs:23-35`, `waitForReleasePage`.
- Evidence: empty-pointer caching was demonstrably fixed and regression-tested; renderer/manifest/store/Worker agree on `/_cms/releases/<release-id>/assets/styles.css` → `releases/<release-id>/assets/styles.css`. Original failing response HTML was not captured. Four reported later passes support current local behavior but cannot prove that historical cause.
- Blocks local approval: **NO independently**. Blocks staging: **NO independently**, but first-activation/cold-start checks are required before staging acceptance.
- Correction: preserve observed hrefs/active ID on future failure; explicitly validate first activation from null, warm replacement and rollback across cold/multiple isolates. Do not loosen the versioned-CSS assertion.

### Verified boundaries and practical limits

- Content UPDATE/DELETE retain atomic ID/composite-key + revision guards and use returned target identity; UPDATE requires next revision exactly once. Media guarded replacement/metadata/archive use returned identity/revision and mutation-token guards. Searches found no remaining aggregate meta.changes success decision; it remains diagnostic metadata only. Zero returned rows are rejected. Trigger-inclusive metadata is simulated by existing tests.
- Snapshots are transactionally captured, bounded, SHA-256 checked, and protected by immutable update/delete triggers. Immutable R2 puts use conditional creation plus collision hash checks; verification reads bytes and checks inventory manifest hashes before activation. SQL errors roll back a D1 batch; **zero-row guards do not cause SQL errors**. F1–F3 qualify earlier broad claims that all batch transitions were safe.
- Main activation pointer CAS includes content revision, expected active release/epoch, verified state, inventory count and leased fencing ownership. Injected SQL/R2/render failures in existing tests preserve the pointer. The verified defects concern surrounding inventory/recovery/losing-rollback transitions.
- Review QR checks remain before release serving. JWT verification requires RS256, matching issuer/audience, valid exp/nbf and verified signature; bounded JWKS fetch/cache and active subject+email D1 allowlist remain. Same-origin checks guard mutations. Local auth requires explicit server config plus loopback; diagnostics additionally require explicit diagnostic config and a test-category identity. No public-host bypass or diagnostic endpoint was found.
- Private originals/drafts and private preview variants remain behind authenticated CMS APIs; manifests/server/config files are excluded from static output/public release routes. Public derivatives are content-addressed, immutable and intended for unauthenticated public delivery. A short pre-activation public marketing-derivative window is already accepted.
- Empty active pointers are not cached. Nonempty pointers have a 3-second per-isolate cache; publish/rollback can therefore serve the prior intact release briefly. Separate EN/ZH requests across isolates can straddle a transition, but each rendered page references its own release's CSS/JS. Missing active pages return 503; missing versioned assets return 404 rather than baseline fallback. Staging must verify CDN/browser behavior and aliases in real Assets routing.
- No destructive GC exists in the publishing report path. Active/previous releases and immutable history are retained; reverse rollback passes. Storage/snapshot history grows without a deletion policy. F8 qualifies claims about interrupted runtime-test data safety.

### Staging boundary and next action

**Next action: obtain authorization for a narrow correction pass for F1–F6, then rerun automated/interleaving and external local HTTP checks. No implementation changes were authorized or made in this read-only review.** No migration/import/reset is needed merely to rerun the current local harness. Restart the local Worker after any future code/config fix.

Staging requires separate explicit authorization and isolated Worker/deployment configuration; ASSETS with run_worker_first; separate CMS_DB/D1 migrations and allowlist; private R2 with public access disabled; distinct public-derivative R2/CDN delivery URL; staging Access application/team/audience/policy covering Admin and CMS APIs; staging-only Review QR secrets; local auth/diagnostics unset; secrets via bindings; and no automatic main/production deployment. Nothing was provisioned.

Before staging acceptance, validate hosted D1 RETURNING and actual interleaving/transaction failures, R2 conditional writes/byte integrity, same-key publish duplication/recovery, cold first activation and pointer cache behavior, concurrent rollback, authenticated owner-upload publishing and public CDN delivery, browser CSP/GA behavior, resource limits, and real Access/JWKS rotation/failure behavior. No staging or production authorization is implied by local acceptance or this review.

Reference semantics checked: [Cloudflare D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Workers resource limits](https://developers.cloudflare.com/workers/platform/limits/), [CSP script-src inline rules](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).

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


## Phase 3C focused review corrections — 2026-10-11 Asia/Singapore

**Status: local correction pass implemented; Phase 3C remains PENDING external real-workerd validation.** The earlier read-only review's six findings F1–F6 were addressed locally. No Phase 3B/other scope, staging, production, Cloudflare resource, deployment, push of CMS code, or main merge was performed. The user-reported four prior successful workerd runs predate these fixes and do not validate them.

### Corrections and files

- **F1 — stale release inventory writer:** `cms/publishing/release-pipeline.mjs` now claims a unique per-batch operation token only while the current slot/job/fence/lease, source revision, epoch, active release, and building states match. All inventory deletion/inserts, object-count and manifest changes depend on that token within one D1 batch; a losing claim throws `publish_fence_lost` before touching inventory. Verification requires returned target rows. Stale API catch handling no longer marks a job failed after `publish_fence_lost` or stale content. Phase progression cannot regress an objects-written job to rendered.
- **F2 — rejected expired resume:** resume uses a fresh operation token and gates reset of the job, version, inventory and token clear on the winning slot claim and expected old state in one batch. A losing/stale claimant leaves inventory and job state unchanged.
- **F3 — rollback losing CAS:** rollback's in-flight job invalidation now depends on the same winning `transition_id`; losing rollback cannot stale the competing publisher.
- **F4 — local public media path and coverage:** `wrangler.cms.local.jsonc` now uses the Worker-supported `/_cms/public-media` route. The runtime test retains an uploaded fixture, associates it with visible bilingual Gallery content, publishes it and checks unauthenticated public GET, WebP type and immutable caching. Fixture cleanup removes its Gallery row; referenced media is retained to avoid unsafe archival against release history.
- **F5 — release CSP / GA:** `cms/publishing/api.mjs` allows only the existing inline GA bootstrap using its exact SHA-256 CSP hash, without adding `unsafe-inline` to `script-src`. Renderer tests verify EN/ZH release HTML and served CSP contain the matching hash.
- **F6 — audit actor identity:** publishing/rollback/snapshot/GC audit calls consistently use the canonical `identity.subject`. An authorized router-to-publishing test asserts the subject is recorded in snapshots, jobs, rollback audit and GC reports.
- **Migration:** new `cms/migrations/0004_publish_operation_token.sql` adds nullable operation-token state to the local CMS publish slot. `cms/README.md` documents it. The external local D1 database must apply this migration before runtime validation; this is additive and does not reset/re-import/delete existing D1/R2 data.
- **Files changed in this correction pass:** `cms/migrations/0004_publish_operation_token.sql`; `cms/publishing/release-pipeline.mjs`; `cms/publishing/api.mjs`; `wrangler.cms.local.jsonc`; `cms/README.md`; `tests/cms-publishing.test.mjs`; `tests/cms-media-api.test.mjs`; `tests/cms-foundation.test.mjs`; `tests/cms-content-api.test.mjs`; `tests/cms-local-runtime-check.mjs`. Existing Phase 3C files remain uncommitted on `codex/amuse-cms-phase-2`; no CMS code was pushed.

### Validation results and boundary

- **VERIFIED locally:** `node --test tests/*.test.mjs` — **49 passed, 0 failed**.
- **VERIFIED locally:** `npm.cmd run build:assets` succeeded.
- **VERIFIED locally:** `git diff --check` succeeded (Git emitted only LF→CRLF advisory warnings); `node --check` succeeded for `worker.mjs`, publishing pipeline/API, and relevant publishing/runtime test modules.
- No real Wrangler/workerd run was performed in this correction pass. It remains essential because operation-token D1 batch behavior, actual Worker runtime media delivery, and release CSP must be checked over HTTP. Root causes F1–F6 were supported by the preceding review's reproductions/source evidence; these corrections have Node regression coverage but are not externally validated yet.
- Temporary loopback-only D1 diagnostics remain pending successful external workerd verification. No secrets are part of diagnostics.
- **Worker restart:** yes, stop and restart the running local Worker after applying the migration, so the new code/config is loaded.
- **Import/reset:** no content import, database reset, R2 wipe or deletion is required or requested. Apply only the additive local migration.

### Exact next external PowerShell commands

From the repository root, in PowerShell window #1:
```powershell
npm.cmd run cms:migrate:local
npm.cmd run cms:dev:local
```
In PowerShell window #2:
```powershell
npm.cmd run test:cms:local
```
The migration command applies pending local schema only and preserves records. Keep the complete test output. A pass must reach the end of the HTTP harness, including the owner-upload → bilingual Gallery association → publish → public derivative GET and release/rollback checks. If it fails, retain diagnostics and do not reset/re-import local data. Phase 3C remains **PENDING** until this real-workerd run passes. Staging and production remain unauthorized.


## FINAL SCOPED F1–F6 SECURITY RE-REVIEW — 2026-10-11 Asia/Singapore

**Final recommendation: A — APPROVE Phase 3C local implementation.** The reviewed F1–F6 corrections are supported by actual source inspection, passing existing tests, additional deterministic in-memory reproductions with complete persistent-table comparisons, and **USER-REPORTED 4 consecutive successful post-fix real local workerd HTTP runs**. These four post-fix passes are distinct from the previously reported pre-correction runs. No new external workerd execution was performed by this review. User final approval is not inferred; staging and production are not authorized.

### Method and D1 semantics

Read actual `cms/publishing/release-pipeline.mjs`, publishing API/storage/renderer, migrations, Worker routing, authorization, local config and tests. Reused the existing publishing test's Node SQLite D1 adapter and fixture helpers through temporary stdin review programs. Databases were exclusively `:memory:`; no durable local D1/R2 was opened, reset, imported, migrated or changed. Implementation/test files were not edited.

Cloudflare's [D1 batch documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/) specifies sequential transactional statements, with SQL errors rolling back the batch. A conditional UPDATE returning no row is still successful SQL and does not abort the batch. This review therefore compared all rows/all columns of **every CMS table**, not merely exceptions or pointer values. For interleaved winners, the baseline was captured after the winner's writes and before the loser's batch.

**VERIFIED:** 15 successful additional in-memory concurrency/recovery/migration checks, plus an exact CSP check on all 12 rendered HTML pages:
1. F1 stale inventory writer after activation: all tables unchanged.
2. F1 write against verified inventory before activation: all tables unchanged.
3. F1 genuine competing new-job lease takeover just before inventory batch: loser changes no table after winner.
4. F1 duplicate inventory writer after first inventory write: all tables unchanged.
5. F1 injected duplicate inventory key/SQL error: entire batch, including operation token, rolled back; all tables unchanged.
6. F2 expired resume after content revision changed: all tables unchanged.
7. F2 competing real new-job claim just before expired-resume batch: loser changes no table after winner.
8. F2 legitimate building-job expiry: same job/snapshot, next fence exactly once, token cleared, successful subsequent activation.
9. F2 legitimate verified-candidate expiry: safe resume and activation.
10. F3 epoch change during awaited storage verification: losing rollback changes no table and leaves in-flight publisher intact.
11. F3 actual new publish activation during awaited rollback verification: losing rollback changes no table after winner.
12. F3 successful rollback and reverse rollback: active pointer swaps correctly; inventory and snapshots preserved.
13. Migration 0004 applied to populated migration-0003 in-memory database: all old values/rows preserved; operation_token NULL; foreign_key_check empty and integrity_check ok.
14. F2 same-idempotency-key competing resume stays building: losing resume changes no table after winner.
15. F2 same-idempotency-key competing resume completes activation: losing resume changes no table after winner.

These review programs are ephemeral checks and were not added to the repository. Hosted D1 concurrent-load behavior remains a staging validation boundary.

### Individual findings disposition

**F1 — FIXED (previous HIGH).**
- `cms/publishing/release-pipeline.mjs:142–181`, `writeReleaseInventory`.
- A single atomic claim requires current slot job/fence/lease, NULL operation token, building job with claimed/rendered phase, building version, expected source revision and publication epoch/active pointer.
- Each subsequent inventory DELETE/INSERT, job/object-count update, manifest update and token clear depends on that same unpredictable per-batch token plus appropriate job/version state. No other request can interleave inside the D1 transaction. A losing claim cannot satisfy any downstream token predicate; zero-row results commit no writes.
- Activated/verified versions and stolen fences were tested with complete database comparisons. Phase regression to rendered is rejected; the API avoids failPublishJob for recognized lost-fence/stale-content errors. No new operation-token race was demonstrated under these interleavings.

**F2 — FIXED (previous HIGH).**
- `cms/publishing/release-pipeline.mjs:29–59`, expired branch of `createPublishJob`.
- Slot claim checks the observed owner/fence, expiry, global content revision, publication state and existing job state. Job/version reset, inventory deletion and token clear depend on the winning new token/fence inside the same batch.
- Changed revision, a new competing job, and same-key competing resumes (including winner activation) all reject without additional database changes.
- Valid expiry recovery works for both building and verified candidates. Snapshot is preserved, fence advances once, token clears, and candidate can activate. Migration 0004 is additive; old slot rows receive NULL token.

**F3 — FIXED (previous HIGH).**
- `cms/publishing/release-pipeline.mjs:287–330`, `rollbackPublishedRelease`; job invalidation at lines 314–316 now requires this rollback's successful transition_id.
- Pointer/epoch, audit-success insertion, version metadata, job invalidation and slot/fence transition all depend on the winning transition. A losing rollback leaves every table unchanged after the competing transition.
- The outer API intentionally may append a failure audit record after rejected rollback; that is expected audit behavior, not a partial pointer/job/slot mutation. Successful rollback and reverse rollback remain covered.

**F4 — FIXED (previous MEDIUM), with a coverage limit noted.**
- Local config line 27 uses `http://127.0.0.1:8787/_cms/public-media`, matching `worker.mjs:20`. Public routing accepts only the optimized published WebP namespace.
- HTTP harness `tests/cms-local-runtime-check.mjs:135–148,213–222` uploads/reuses owner-upload media, associates it to a visible Gallery item with bilingual title/caption/alt, publishes before fetching the rendered image URL, and asserts public 200, WebP signatures/type, immutable cache and private-original 404.
- The post-fix four consecutive PASS runs are user-reported evidence that this sequence ran successfully. Harness tests English Gallery's image GET and Chinese homepage/release consistency; it does not separately GET the uploaded-image tag on Chinese Gallery. This is a nonblocking coverage improvement; the shared bilingual renderer and bilingual input are inspected/tested.
- One older direct publishing fixture at `tests/cms-publishing.test.mjs:272` still supplies the obsolete double-underscore base; it uses legacy media and does not exercise public uploaded delivery. This is LOW test-fixture cleanup, not the active local config or runtime harness.

**F5 — FIXED (previous MEDIUM).**
- `cms/publishing/api.mjs:103`, `serveReleaseObject`; `tests/cms-publishing.test.mjs:198`; HTTP harness lines 197–212.
- Computed SHA-256 of the actual GA bootstrap on all **12** rendered EN/ZH pages exactly equals `NcJIkUciywrk/xnjzNolz6wY19tr9mymHpKfKlzfHSk=`, and served CSP contains its matching hash.
- No `unsafe-inline` occurs in script-src; inline styles remain allowed in style-src as before. This does not allow arbitrary inline scripts. Browser telemetry/CTA delivery still requires staging browser verification.

**F6 — FIXED (previous MEDIUM).**
- `cms/auth/authorize.mjs:44–46` supplies canonical authorized subject; publishing API lines 22,45,54,85–86 now consistently consume `identity.subject`.
- `tests/cms-publishing.test.mjs:300–315` exercises the authorized router: two snapshots and jobs, three successful publish/rollback audit records, and the GC report carry `local-test-owner`. This verifies real router identity handoff rather than only a direct fabricated API identity.

### Validation and remaining findings

- `node --test tests/*.test.mjs`: **49 passed, 0 failed** in this review.
- Additional in-memory checks above: **15 passed**; rendered exact CSP check: **12/12 HTML pages passed**.
- Relevant `node --check` commands and `git diff --check` passed. Git's existing LF/CRLF advisory warnings are not failures.
- No build/deployment, durable migration/import, Wrangler/workerd process, or Cloudflare resource operation was run in this read-only review.
- **No residual HIGH/MEDIUM implementation defect was demonstrated within F1–F6's scoped scenarios.** This is not a proof against all failures or a hosted readiness claim.
- **LOW operational risk retained from prior review:** interrupted loopback HTTP harness can leave parking_note draft changed before its later restoration; release history and referenced media intentionally accumulate. Do not run this harness against staging/production or equate successful repeated runs with zero durable writes. No destructive garbage collection was introduced.
- Prior first-run CSS failure's exact historical response remains unavailable. Empty-pointer regression coverage and subsequent passes support current behavior without proving the original forensic cause.
- Existing JWT verification, active D1 allowlist, same-origin checks, local/public-host isolation, immutable SHA-256 manifests, optimistic RETURNING guards and Review QR protection pass the full suite.

### Staging boundary and next action

Local acceptance is justified; obtain the user's final Phase 3C sign-off before changing phase. No further local rerun is demanded solely by this documentation review.

Staging remains a separate approval and validation gate:
- Isolated Worker/config, D1 with all migrations and staging-only allowlist, private R2, public immutable derivative delivery hostname/bucket, real Access issuer/audience/policies and staging-only secrets. No automatic production/main deployment.
- Hosted D1 RETURNING/batch/interleaving and lease-failure tests; R2 conditional writes, hash verification, owner-upload/CDN delivery; first activation/cold/multiple isolates, 3-second pointer-cache transitions and rollback.
- Browser CSP/GA/CTA initialization, actual Access/JWKS rotation and failure handling.
- Account plan, image-processing CPU/memory/concurrency suitability and safe upload limits remain unresolved hosted risks; Node/workerd functionality is not evidence of isolate resource capacity.
- **Before staging:** remove temporary local D1 console instrumentation in a separately authorized cleanup, or at minimum exclude/disable it; staging must have CMS_LOCAL_AUTH and CMS_D1_DIAGNOSTICS unset. Current diagnostic activation still requires both explicit flags, loopback hostname, test-owned runtime-check category and authorization; it is not publicly client-enabled. No diagnostics were removed in this read-only task.
- Retention growth, bounded pointer-cache staleness and interrupted-test draft recovery remain operational considerations, separately from local approval.

### Git/documentation synchronization

Source branch remains `codex/amuse-cms-phase-2`, HEAD `fbe81df0827a5604b7466d97e10f2864c21df78f`; CMS implementation stays uncommitted. Local main remains `218d180e9618f266b27fdd98bd2d60592fc836cc`; remote main was read at `ede5c0d61f3f92b30d459bd4d4bb66de55402d3a`. Only `project-brain/CURRENT_STATE.md` is synchronized to `docs/amuse-cms-shared-state` through GitHub's contents API. No implementation changes/push, main merge, deployment or Cloudflare resources.
