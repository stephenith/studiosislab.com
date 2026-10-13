# StudiosisLab E-sign

> Subordinate product note. Not a department master.  
> Code in `src/` overrides this note.  
> Do not treat this note as authority to change Resume Template, `firestore.rules`, shared Firebase/auth/mail modules, `SOS/STUDIOSISLAB_PROJECT_MASTER.md`, or `SOS/project-state.json`.  
> **Recorded:** 2026-10-09 17:02 IST (`2026-10-09T17:02:00+05:30`) / `2026-10-09T11:32:00.000Z`

---

## Baseline

| Item | Value |
|------|--------|
| Branch | `main` |
| Git HEAD | `867b8d7296e62968b285f4948e7a7925c99a47bc` |
| HEAD meaning | Docs-follow commit. Not proof of the Vercel deploy. |
| This note | Local worktree record only. Not deployed. |
| Project master / project-state | Unchanged by this e-sign pass. |

E-sign is a public product surface (`/tools/esign`). It is not an AIOS department and it does not import Resume Template code.

---

## Pre-existing uncommitted PNG/JPEG work

Left in place. Not introduced by the lock, wording, or placement-merge pass.

| Path | State |
|------|--------|
| `src/lib/esignSignatureImage.ts` | Untracked. Byte-sniffs PNG vs JPEG and fails before a partial PDF. |
| `src/lib/esignSignatureImage.verify.ts` | Untracked verifier. |
| `src/lib/esignSignatureUpload.ts` | Untracked. PNG/JPEG selection check. |
| `src/lib/esignUploads.ts` | Untracked. |
| `src/app/api/esign/export/route.ts` | Modified. Calls `buildSignedPdf`. |
| `src/app/api/esign/invite/complete/export-failure.verify.ts` | Untracked. Mocked export failure. |
| `src/app/api/esign/invite/complete/export-failure.firebase.cjs` | Untracked Firebase/Storage mock. |
| `src/app/api/esign/invite/complete/export-failure.mail.cjs` | Untracked mail mock. |
| `src/app/api/esign/init/`, `src/app/api/esign/finalize/` | Untracked. Not part of this pass. |

Whether that PNG/JPEG work is on the live site is unknown. This pass did not deploy it.

The export-failure verifier payload now includes `id: "synthetic-recipient"` so the new completion check still reaches the mocked export failure. The Firebase mock reads `globalThis.__esignStoredPlacements` when a test sets it, and otherwise keeps the original stored row.

---

## Changes in this pass

### Lock button

`src/lib/esignViewerState.ts` owns the three states. `SignatureToolsPanel.tsx` renders them.

| Selection | Control |
|-----------|---------|
| Selected and unlocked | Enabled. Light green background, dark text. Label: “Lock signature to continue.” |
| Nothing selected | Disabled. Guidance: “Select a placed signature first.” |
| Selected and locked | Enabled. Label stays “Unlock Signature.” |

Placement, selection, and the existing download/share/complete gates are unchanged.

### Recipient wording

The recipient panel follows the recipient’s own signature and the real completion state:

`insert` → `lock` → `ready` → `completing` → `completed`

Pending invite validation shows “Checking this invitation.” An invalid invite shows that it cannot be used to complete the agreement. Neither state says the recipient can complete. The action label is “Complete agreement” until the agreement is actually completed, when it becomes “Agreement completed.”

The title shows “Waiting for countersign” when status is `waiting_countersign` or countersign has been sent and the agreement is not completed. “Completed” is used only for a completed document or a completed recipient action in this session.

### Completion placement merge

`src/lib/esignPlacements.ts` runs in `POST /api/esign/invite/complete` after invite checks and before export, Storage, status writes, or email.

The current client sends only the recipient signature whose id matches the recipient’s own signature, including that id. Stored sender placements that already have an image are kept once, in order, then the recipient object is appended. Distinct ids at the same coordinates stay distinct. Coordinates and image bytes are not used to merge.

These submissions return HTTP 400 and do not export, save, update status, or send email:

| Case | Error |
|------|--------|
| No recipient signature | Recipient signature is missing. Refresh the page and try again. |
| More than one incoming placement (older open tab) | This signing session is out of date. Refresh the page and try again. |
| Missing or blank id | Recipient signature is missing an id. Refresh the page and try again. |
| Missing image | Recipient signature image is missing. Refresh the page and try again. |
| Recipient id matches a stored sender id | Recipient signature conflicts with a sender signature. Refresh the page and try again. |

---

## Outlines

Border rendering, saved placements, and coordinates were not changed. The overlay renderer was not extracted.

The live screenshot’s extra red dashed rectangles stay unresolved. A redacted read of placement ids, page, normalized boxes, lock flags, image presence, document status, and countersign status would be required. Image bytes, tokens, emails, and names are not required for that diagnosis.

---

## Checks

Synthetic data and mocks only. No browser, server launch, production read, production write, real agreement, email, staging, commit, push, or deploy.

| Check | Result |
|-------|--------|
| `npx tsx src/lib/esignSignatureImage.verify.ts` | PASS |
| `npx tsx src/app/api/esign/invite/complete/export-failure.verify.ts` | PASS (`storage:0`, `status:0`, `email:0`) |
| `npx tsx src/lib/esignViewerState.verify.ts` | PASS |
| `npx tsx src/lib/esignPlacements.verify.ts` | PASS |
| `npx tsx src/app/api/esign/invite/complete/placement-rejection.verify.ts` | PASS, including export ids `sender-a`, `sender-b`, `recipient-c` once each and zero Storage/status/email side effects |
| `npx eslint` on the touched e-sign files | New files and `SignatureToolsPanel.tsx` clean. Existing `any` / unused-var findings remain in `invite/complete/route.ts` and `EsignViewerClient.tsx`. |
| `npx tsc --noEmit --pretty false --incremental false` | No errors in the e-sign files touched here. Unrelated `src/lib/invoice/generateInvoicePdf.ts` still fails. |

---

## Local browser verification

**Result:** PASS. Not production proof.  
**Observed:** 2026-10-09 17:48 IST (`2026-10-09T17:48:16+05:30`) / `2026-10-09T12:18:16.000Z`

The harness is `.cursor/esign-browser-fixture/`. Evidence is `.cursor/esign-browser-evidence/results.json` plus the screenshots and PDFs in that folder. The server bound `127.0.0.1` only, task PID `41889`, and that process was stopped after the run. Firebase, admin, and public-app URL environment values were removed before startup. `.env.local` was not read. Non-loopback sockets throw. The browser aborted any request that was not loopback.

The page mounted the real `EsignViewerClient` and `SignatureToolsPanel`. Completion used the real `POST /api/esign/invite/complete` handler. PNG and JPEG export used the real `buildSignedPdf` path through `POST /api/esign/export`. Firebase, Storage, invitation validation, and email were mocks. The original-PDF download route was not called; the viewer received a synthetic one-page PDF. No production Firebase call, real agreement, or real email occurred.

| Check | Result |
|-------|--------|
| No selection | Lock disabled. Guidance: “Select a placed signature first.” Screenshot `lock-none.png`. |
| Selected and unlocked | Enabled. Light green `oklch(0.95 0.052 163.051)`, dark text `oklch(0.262 0.051 172.552)`. Label: “Lock signature to continue.” Screenshot `lock-unlocked.png`. |
| Lock and unlock | Same signature id and the same `left`/`top` (`320px`, `487.5px`) before lock, after lock, and after unlock. Screenshot `lock-locked.png`. |
| Recipient phases | Insert, lock, ready, completing, and completed matched the panel and title. Screenshots `recipient-lock.png`, `recipient-ready.png`, `recipient-completing.png`, `recipient-completed.png`. |
| Delayed invite | “Checking this invitation.” Complete stayed disabled. Screenshot `recipient-pending.png`. |
| Invalid invite | “This invitation cannot be used to complete the agreement.” Complete stayed disabled. Screenshot `recipient-invalid.png`. |
| Failed completion | Alert: `Failed to generate signed PDF`. Title stayed “Waiting for countersign.” Button returned to enabled “Complete agreement.” Storage, status, and email counts stayed 0. Screenshot `recipient-failed.png`. |
| Successful completion | Title “Completed.” Disabled “Agreement completed.” Storage save 1, status write 1, mock email 2. |
| PNG export | One image in `export-png.pdf`. Render `pdf-png.png`. |
| JPEG export | One image in `export-jpeg.pdf`. Render `pdf-jpeg.png`. |
| Merge | Export placements: legacy sender with no id at `yNorm` 0.14, `sender-same-box` JPEG at `yNorm` 0.62, recipient id `f709f77b-b649-48de-8d8f-acb01f815578` at the same `yNorm` 0.62. The rendered PDF contains 3 image marks. Two share `x=214.2`, `y=237.6`. The red JPEG sits under the blue recipient, so the picture shows two colored bars. Count, not appearance, is the overlap proof. Render `pdf-merged.png`. |

Limitations: this does not prove the live site. The real invite-validate route was not executed, because that route imports Firebase Admin; the viewer was given mocked validate responses. Brand-logo requests 404 in this harness only. The red-rectangle diagnosis from the earlier live screenshot remains unresolved.

## Deployment

Not deployed. The browser check above is local fixture evidence.

---

## Release candidate

**State:** Isolated candidate ready for review. Nothing in this candidate is staged, committed, pushed, or deployed.  
**Recorded:** 2026-10-09 18:19 IST (`2026-10-09T18:19:18+05:30`) / `2026-10-09T12:49:18.000Z`

| Item | Value |
|------|--------|
| Isolated branch | `release/esign-signature-placement` |
| Base | `867b8d7296e62968b285f4948e7a7925c99a47bc` |
| Worktree | `/Users/stephenpereira/studiosislab-esign-rc` |
| Original tree | Still `main` at the same SHA. Concurrent Resume Template edits remain there. |

Proposed production files:

- `src/lib/esignSignatureImage.ts`
- `src/lib/esignSignatureUpload.ts`
- `src/lib/esignViewerState.ts`
- `src/lib/esignPlacements.ts`
- `src/app/api/esign/export/route.ts`
- `src/app/api/esign/invite/complete/route.ts`
- `src/components/esign/SignatureToolsPanel.tsx`
- `src/app/tools/esign/[documentId]/EsignViewerClient.tsx`
- `SOS/01_KNOWLEDGE/StudiosisLab_Esign.md`

Check-only files sit in the worktree so the verifiers can import the candidate routes. They are outside the proposed production commit: `esignSignatureImage.verify.ts`, `esignViewerState.verify.ts`, `esignPlacements.verify.ts`, `invite/complete/export-failure.verify.ts`, `export-failure.firebase.cjs`, `export-failure.mail.cjs`, `placement-rejection.verify.ts`.

Excluded from the worktree: `.cursor/esign-browser-fixture/`, `.cursor/esign-browser-evidence/`, `src/lib/esignUploads.ts`, `src/app/api/esign/init/`, `src/app/api/esign/finalize/`, Resume Template files, `AGENTS.md`, the project master, and `SOS/project-state.json`. The production files do not import the browser fixture, the cjs mocks, or the verifiers.

Candidate checks, re-run in the worktree with no `.env.local` and with Firebase, Google, and public-app URL environment names removed:

| Check | Result |
|-------|--------|
| Five existing verifiers | PASS |
| `eslint` on the eight runtime files | `SignatureToolsPanel.tsx` and the new libraries are clean. Pre-existing `any` and unused-variable findings remain in `invite/complete/route.ts` and `EsignViewerClient.tsx`. |
| `tsc --noEmit --pretty false --incremental false` | PASS (exit 0) |
| `next build` | See the release blocker below |
| Browser fixture | Reused. PASS recorded at 2026-10-09 17:48 IST. The implementation was not changed after that run. |

`src/lib/invoice/generateInvoicePdf.ts` is absent from this base. `git show HEAD:src/lib/invoice/generateInvoicePdf.ts` reports that the path exists on the original disk and is not in HEAD. The earlier invoice type error belongs to that untracked original-tree file. It is not in this candidate and was not changed.

Local `next build` in the worktree:

- Default Turbopack build stops because the worktree `node_modules` symlink points outside the worktree. No packages were installed.
- `next build --webpack` compiled successfully in 11.4s and reached page-data collection.
- Page-data collection then failed for `/api/esign/send-email`: `new Resend(process.env.RESEND_API_KEY)` throws `Missing API key` when the key is absent.
- `src/app/api/esign/send-email/route.ts` blob `403ec8fb228564eba88481c19c7cfe75e6d08db9` matches HEAD. This e-sign diff does not touch that file.
- No secret values were loaded or printed. This is a clean-base local build blocker.

The live red-rectangle diagnosis remains open.

A push is not a confirmed production deploy. `SOS/SAIOS/infra/VERCEL_GIT_VERIFY.md` records production-branch and auto-deploy confirmation as `PENDING_FOUNDER`. There is no `vercel.json` and no `.github/workflows`. The project master assigns the public site to Vercel and AIOS deploys to a fast-forward merge on the VPS. Pushing this branch, pushing `main`, or merging to `main` stays a separate Founder decision.

Founder actions still required, in order: review this worktree diff; then, if accepted, commit only the production file list on `release/esign-signature-placement`; then decide any push, merge to `main`, or Vercel deploy as its own approval. No VPS restart is part of this candidate.

---

## Sender experience

**State:** Implemented on the original `main` working tree. Not copied into `release/esign-signature-placement`. Not staged, committed, pushed, or deployed.  
**Recorded:** 2026-10-13 17:29 IST (`2026-10-13T17:29:23+05:30`) / `2026-10-13T11:59:23.000Z`

Sender-only changes:

- The document Browse control is orange, opens the file picker directly, and keeps PDF type and 50 MB checks. Verify existing agreement is unchanged.
- Upload shows Preparing, Uploading, Saving, and Opening. A percent appears only when the upload reports a computable length. A second Proceed during that upload does not start another one. Navigation waits until finalize succeeds.
- After a successful upload, the same tab keeps the PDF bytes so the viewer does not download the original again. A refresh still uses the download route. pdf.js receives a copy, so the cached bytes stay intact.
- The loading banner clears after the first page. Later pages continue rendering.
- Sender signing methods are three collapsed accordions: Draw signature, Upload signature, and Sign using your mobile. Opening one closes the other. Expanding mobile does not create a link. Drawn strokes, the selected file, and an existing mobile session stay when the panel is collapsed. The recipient panel is unchanged.
- Signature management appears after a signature is placed, including draw, upload, and mobile. Loading an image does not insert it. The sender lock action is solid green with a lock icon and arrow. Unlock uses an open padlock and stays visually separate. The recipient lock stays light green.
- Solo download stays available from the download action. The Workflow Type radios are gone. Countersign opens only after the sender signature is locked, then adds one target, locks or unlocks that target without recreating it, and shows the email fields only while the target is locked. Typed emails remain when the target is unlocked. An invitation that is already sent is not repositioned.
- Icons are from the existing `lucide-react` dependency. No new package.

Checks on 2026-10-13, synthetic data only, loopback fixture, mocked Firebase, Storage, invitation validation, and email:

| Check | Result |
|-------|--------|
| `esignViewerState.verify.ts` | PASS, including sender lock labels |
| `esignOriginalPreview.verify.ts` | PASS. A second load does not call the fetcher. |
| PNG/JPEG, placement merge, export-failure, and placement-rejection verifiers | PASS |
| Browser fixture | PASS. Server PID 52524 was stopped. |

Browser evidence:

- Browse opened the file picker. Orange background `oklch(0.705 0.213 47.604)`, white text. Verify Browse stayed non-orange.
- Upload phases were Preparing, Uploading, Saving, then Opening. The PUT reported `100%`. One init, one PUT, and one finalize. The router recorded `/tools/esign/synthetic-upload` only after finalize. Screenshots `sender-upload-browse.png` and `sender-upload-progress.png`.
- Cold open downloaded the PDF. The seeded same-tab cache opened with download count 0.
- Page 1 cleared loading before pages 2 and 3. The fixture delayed pages 2 and 3 by 300ms each so the order could be observed. The recorded gap was 609ms and includes that fixture delay. It is not a production timing claim.
- Accordions started collapsed and were mutually exclusive. A drawn stroke remained after collapse. Screenshot `sender-accordions.png` and `sender-draw.png`.
- Draw, JPEG upload, and mobile insert each exposed signature management. The sender lock button was solid green `oklch(0.627 0.194 149.214)` with white text. Lock and unlock kept the signature id and position. Screenshot `sender-lock.png`.
- Countersign refused to open before the signature was locked. Add, then lock, revealed the emails. Unlock kept the target id, left, and top, hid the emails, and kept the typed addresses. One mocked invite was posted. The sent target stayed fixed. Screenshots `sender-countersign-add.png` and `sender-countersign-emails.png`.
- A reloaded document restored signature `restored-sig` and target `restored-box` without offering another Add box. Selecting that locked signature showed Unlock and did not move it.
- Download stayed disabled until a signature was locked, then enabled while countersign was in progress.
- At 390px width, visible buttons stayed inside the viewport. Screenshot `sender-narrow.png`.
- Recipient lock stayed light green `oklch(0.95 0.052 163.051)` with dark text. PNG export drew 1 image, JPEG export drew 1 image, and the merged completion drew 3 images.

Loading findings:

- The old path waited through init, the storage PUT, finalize, viewer metadata, a second download of the same PDF, and rendering of every page before the viewer was usable.
- Two product changes remove work: the same-tab cache skips that second download, and the first page is shown before the remaining pages finish.
- The fixture measured the skip as 0 download requests when the bytes were already stored, and measured first-page ordering with an artificial page delay. It did not time a before-and-after against live storage. The upload percent and the Preparing/Saving/Opening lines are status feedback. The fixture also delayed those responses so the labels could be seen.

Limitations at the time of that section: the sender pass was local only. The overlapping red-rectangle diagnosis remains open. Borders and saved placements were not changed.

---

## Public release

**State:** Deployed to the public site.  
**Recorded:** 2026-10-13 17:52 IST (`2026-10-13T17:52:17+05:30`) / `2026-10-13T12:22:17.000Z`

| Item | Value |
|------|--------|
| Release commit | `c1f2fdbb608a530432318e635ba5caebd773c345` |
| Parent | `867b8d7296e62968b285f4948e7a7925c99a47bc` |
| Branch | Fast-forward of `main`. Release branch `release/esign-signature-placement` points at the same commit. |
| Vercel project | `studiosislabcoms-projects/studiosislab-com` |
| Deployment | Production. GitHub deployment `7038260866` state `success`. Created `2026-10-13T12:19:59Z`. Completion observed `2026-10-13T17:50:27+05:30` / `2026-10-13T12:20:27.000Z`. |
| Deployment URL | `https://studiosislab-o12z8074z-studiosislabcoms-projects.vercel.app` |
| Inspector | `https://vercel.com/studiosislabcoms-projects/studiosislab-com/Emi6A6HkkBt3ojZgBRR8ziDKSR6E` |
| Public site | `https://www.studiosislab.com/tools` |

The deployment hostname asks for Vercel login. The public check used `https://www.studiosislab.com`.

Live page assets on that domain contain `Click to share for countersignature`, `Lock your signature before sharing for countersignature.`, `Draw signature`, and `Sign using your mobile`. The same viewer asset does not contain `Workflow Type` or `Solo Sign`. The tools-page asset contains `Preparing upload…` and `Opening document…`. No agreement was uploaded, signed, completed, or emailed.

Release files:

- `src/lib/esignSignatureImage.ts`
- `src/lib/esignSignatureUpload.ts`
- `src/lib/esignViewerState.ts`
- `src/lib/esignPlacements.ts`
- `src/lib/esignOriginalPreview.ts`
- `src/lib/esignSignedUpload.ts`
- `src/app/api/esign/export/route.ts`
- `src/app/api/esign/invite/complete/route.ts`
- `src/components/esign/SignatureToolsPanel.tsx`
- `src/app/tools/esign/[documentId]/EsignViewerClient.tsx`
- `src/app/tools/ToolsHubClient.tsx`

Excluded from the commit: browser fixture and evidence, verifier files, Firebase and mail mocks, `src/lib/esignUploads.ts`, unused `src/app/api/esign/init/` and `finalize/`, the invoice-generator link, `package-lock.json`, Resume Template files, `AGENTS.md`, the project master, and `SOS/project-state.json`.

Checks before the push, in the isolated worktree, with no `.env.local`:

| Check | Result |
|-------|--------|
| Six verifiers, including preview cache | PASS |
| `tsc --noEmit` | PASS after restoring the pdf.js legacy import suppression as `@ts-expect-error` |
| `next build --webpack` | Compile and TypeScript succeeded. Page-data collection then failed because `RESEND_API_KEY` and the Firebase Admin variables were absent. `send-email/route.ts` and `firebaseAdmin.ts` match the parent commit. |
| Browser fixture | Reused from 2026-10-13 17:29 IST. Not re-run after the comment-only type suppression. |
| Vercel production | Success, recorded above. |

The overlapping red-rectangle diagnosis remains unresolved. This release does not hide borders or delete placements.

---

## Sender follow-up

**State:** Deployed to the public site.  
**Recorded:** 2026-10-13 18:44 IST (`2026-10-13T18:44:44+05:30`) / `2026-10-13T13:14:44.000Z`

The prior production SHA `069a7be1ebb50e3fce5bf0a6b5c9ed1f74d9ab1e` was still current before this follow-up. Upload progress was left unchanged.

Cause of the disappearing countersign box: the overlay effect rebuilt the target whenever page rendering, zoom, or the saved position changed. Rebuild removed the DOM node while a drag or resize still held that node. Pointer-up then read the detached node, which has no size, and stored a zero-size target. The lock control stayed because the placeholder record remained. This is separate from the unresolved overlapping red rectangles.

The corrective change keeps the node mounted during the gesture, ignores a measurement that is not finite and positive, and restores the existing target identity and coordinates. It does not create a replacement at the default position, and it does not move a target that has already been sent.

Sender behavior now allows one placed signature at a time. Insert is hidden for draw, upload, and mobile while any signature remains, including after reload and on documents that already have several saved signatures. Those older signatures are left in place. Lock and unlock do not bring Insert back. Delete does. The insert handler also refuses a second placement, so hiding the button is not the only guard. Recipient insertion is unchanged.

Button changes: after the sender signature is locked, “Click to share for countersignature” is solid green with light text and stays visually disabled before that. “Add countersign box to continue” stays orange, with a plus icon and a trailing arrow. The unlocked target action is “Lock countersign position to continue”. Unlock stays “Unlock countersign position”. Eligible “Share for countersign” is light green with dark text; invalid and sending states stay disabled.

| Item | Value |
|------|--------|
| Follow-up commit | `9f6e3569b3acee302281429dac484e4082b77a1f` |
| Parent | `069a7be1ebb50e3fce5bf0a6b5c9ed1f74d9ab1e` |
| Vercel project | `studiosislabcoms-projects/studiosislab-com` |
| Deployment | Production. GitHub deployment `7039443991` state `success`. Created `2026-10-13T13:13:47Z`. Completion observed `2026-10-13T18:44:10+05:30` / `2026-10-13T13:14:10.000Z`. |
| Deployment URL | `https://studiosislab-qfrw1byid-studiosislabcoms-projects.vercel.app` |
| Inspector | `https://vercel.com/studiosislabcoms-projects/studiosislab-com/8n4p7nncsHbePzsyM93BPvWwkoH3` |
| Public site | `https://www.studiosislab.com/tools` |

Live `www.studiosislab.com` assets contain “Add countersign box to continue”, “Lock countersign position to continue”, and “Unlock countersign position”. No agreement was uploaded, signed, completed, or emailed.

Checks, synthetic data only, loopback fixture, mocked Firebase, Storage, invitation validation, and email. Server PID `55270` was stopped after the run.

| Check | Result |
|-------|--------|
| Repeated and rapid Insert | One signature |
| Method switch and mobile fetch while a signature remains | No second signature |
| Delete | Insert returns |
| Lock and unlock | Insert stays hidden |
| Restored and two-signature legacy documents | Existing signatures kept; Insert stays hidden |
| Drag during a zoom rebuild, resize, scroll, zoom, lock, and unlock | Target stays visible, on page 1, with finite size and the same id |
| Button colors | Locked share entry solid green; add control orange; eligible share light green with dark text; invalid share disabled |
| PNG/JPEG, placement merge, export-failure, placement-rejection, viewer state, and preview-cache verifiers | PASS |
| `tsc --noEmit` in the release worktree | PASS |

Screenshots: `sender-countersign-entry.png`, `sender-countersign-add.png`, `sender-countersign-box.png`, `sender-countersign-emails.png`, `sender-narrow.png`.

The overlapping red-rectangle diagnosis remains unresolved.

---

## Recipient experience

**State:** Deployed to the public site.  
**Recorded:** 2026-10-13 19:36 IST (`2026-10-13T19:36:24+05:30`) / `2026-10-13T14:06:24.000Z`

Production was still `a759bfed76c3d78cef75e942858cc41d71408b52` before this change. The sender flow was left in place.

Recipients now use the same three signing methods as the sender: Draw signature, Upload signature, and Sign using your mobile. Opening one closes the other. Drawn strokes, the selected file, and a mobile session stay when the method changes. Opening the mobile method does not create a session.

A recipient mobile session is created only for an authenticated invitation that is still `sent` or `viewed`. The session stores the document owner in `ownerUid` and the recipient in `recipientUid`, with the invitation id. It does not make the recipient the document owner. Fetch is allowed for that recipient through the e-sign API. Completed, expired, and foreign invitations cannot create or use a session. The phone submit and validate routes re-check the invitation before accepting a drawing. Recipient signatures are not written by sender autosave. `firestore.rules` and shared authentication were not changed. Recipient browsers still cannot subscribe to the session directly, because those rules allow only the document owner to read it.

After the recipient inserts one signature, Insert is hidden for all three methods. The insert handler ignores a second click, a method switch, and a mobile fetch. Sender signatures do not count as the recipient signature. Deleting the recipient’s own signature brings Insert back while the invitation can still be signed. The lock action is solid green, with a lock icon and a forward arrow. Unlock stays available before completion and does not move the countersign target or release the placement limit.

On the recipient screen, sender signatures keep their image, page, position, and size, without selection handles or a red dashed border. The red dashed countersign target is the sender’s saved locked position and is visible before insertion. The recipient cannot drag, resize, unlock, or delete that target. Drawing, upload, JPEG, and mobile insertion place the signature inside the target on its page, preserving aspect ratio. The recipient can resize that image only while it remains inside the target. Locking freezes the adjustment. Saved normalized coordinates are what zoom and re-render use. If the stored target is missing or not locked, the page shows “This agreement has no countersign position. Completion is unavailable.” and completion stays disabled.

Completion reads the allowed target from the stored document, not from the browser. A wrong page or a signature outside that target is rejected before export, storage, status, and email. A signature that fits inside the target is accepted.

A completion attempt claims the invitation by setting its status to `completing`, with `completionClaimId`, `completionClaimUid`, and `completionClaimedAt`. Those three fields are the only new persisted state, and they are cleared when the attempt finishes or is released. A second attempt while the claim is under two minutes old does not export or email. If export fails, the claim is released and the invitation returns to its previous status, so it is not marked completed and can be tried again. If the process stops after the claim and before release, the same recipient can retry after two minutes. After a successful export, one transaction writes the completed invitation and document, then one pair of completion emails is sent. An invitation that is already completed returns the stored PDF and does not export, update completion again, or send email. Validation reports `completed` before the expiry check, so reopening a finished link stays read-only. An unfinished expired invitation is still rejected. The completed view and download use `/api/esign/download?documentId=…&final=1`.

| Item | Value |
|------|--------|
| Product commit | `494594dfddab8f130225513e4c795b0cfc0f2af6` |
| Parent | `a759bfed76c3d78cef75e942858cc41d71408b52` |
| Vercel project | `studiosislabcoms-projects/studiosislab-com` |
| Deployment | Production. GitHub deployment `7040647780` state `success`. Created `2026-10-13T14:04:55Z`. Public chunk check `2026-10-13T19:35:31+05:30` / `2026-10-13T14:05:31.000Z`. |
| Deployment URL | `https://studiosislab-ob5t1hs3f-studiosislabcoms-projects.vercel.app` |
| Inspector | `https://vercel.com/studiosislabcoms-projects/studiosislab-com/paakA5FTim7ShWeiHFDRPCSANXbM` |
| Public site | `https://www.studiosislab.com/tools` |

Live `www.studiosislab.com` chunk `/_next/static/chunks/ec424e44ca23f897.js` contains “Countersign complete.” and “Download completed agreement”. No agreement was uploaded, signed, completed, or emailed.

Checks used synthetic documents and mocked Firebase, Storage, email, and invitation state. The browser fixture listened on `127.0.0.1` only. Server PID `58173` exited after a PASS run.

| Check | Result |
|-------|--------|
| Three recipient accordions, retained strokes and selected file | PASS |
| PNG, JPEG, drawing, and mobile fetch insertion | PASS in the browser. Mobile fetch used the fixture’s canned PNG. The phone drawing page was not opened. |
| Repeated insert, method switch, and mobile fetch | One recipient signature |
| Sender marks | No red border and no edit handles |
| Fixed target | Visible before insertion and not moved by resize or unlock |
| Resize | Stays inside the target. Zoom keeps the normalized position. |
| Wrong-page completion | Rejected with no storage write, status write, or email |
| Completion, refresh, and reopening | “Countersign complete.” Signing controls are gone. |
| Repeated completion | One save and one email pair |
| Overlapping completion | One export and one email pair. The other attempt is busy. |
| Export failure | Invitation returns to an incomplete status |
| Existing sender, PNG/JPEG, placement, and preview checks | PASS |
| `tsc --noEmit` in the release worktree | PASS |

Screenshots: `recipient-target.png`, `recipient-methods.png`, `recipient-lock.png`, `recipient-ready.png`, `recipient-failed.png`, `recipient-completing.png`, `recipient-completed.png`, `recipient-reopened.png`.

The overlapping red-rectangle diagnosis remains unresolved. Recipient session reads go through the e-sign API because the existing Firestore rule still allows only the document owner to read a mobile session.

---

## What this note does not authorize

- Resume Template edits
- `firestore.rules` edits
- Shared Firebase, auth, or mail module edits
- Root dependency changes
- Production or staging use of a real agreement
