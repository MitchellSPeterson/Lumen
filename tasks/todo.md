# Automatic planner creation checklist

## 1. Connect subscription

- [x] Native adapter discovers Codex runtime, owns stdio process, initializes RPC, and reports actionable missing-runtime/auth/disconnection errors.
- [ ] App-owned Sign in with ChatGPT works; native code protects and refreshes credentials; model catalog populates selector and a small structured-output turn verifies chosen Luna access.
- [ ] Verify restricted filesystem/tools configuration, cancellation, bounded output, and process cleanup; failure leaves planner untouched.

Verification: native protocol tests with fake child process; manual sign-in/model/structured-output probe; launch packaged app from Finder.
Dependencies: none. Medium scope. Likely files: new `src-tauri/src/codex.rs`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, new `src/agent.ts`. Split credential flow into a separate focused patch if adapter exceeds this scope.

## 2. Compose typed or dictated prompt

- [x] Accessible "Plan with AI" composer has multiline prompt, model selector, connection state, Generate, and Cancel; preserve draft after error.
- [ ] macOS system Dictation enters editable text in native window; Return/newline/composition never submits prematurely.
- [x] Generate requires connected state, chosen model, nonempty bounded prompt, active project, and no active run; explain context sent to Codex.

Verification: native typed/dictated multiline smoke test, keyboard/focus check, `npm run build`.
Dependencies: 1. Medium scope. Likely files: new `src/PlannerComposer.tsx`, `src/App.tsx`, existing stylesheet, `src/agent.ts`.

## Checkpoint A

- [ ] Subscription + structured-output probe succeeds and native dictation works before proceeding with full generation integration.

## 3. Convert draft into planner content

- [x] Strict bounded draft validates enums, temporary keys, references, same-project hierarchy, cycles, and link pairs before any mutation.
- [x] App allocates UUIDs/defaults and produces additive candidate from latest workspace; only new nodes receive layout positions.
- [x] Invalid draft produces zero changes; existing item content/positions survive valid merge; duplicate related links are omitted.

Verification: focused new Vitest fixtures/tests for valid nested drafts, invalid/cross-project/cyclic refs, bounds, and existing-item preservation.
Dependencies: 1. Medium scope. Likely files: new `src/planner.ts`, new `src/planner.test.ts`, `src/domain.ts`, `src/mapLayout.ts` only if reuse requires a change.

## 4. Generate and save automatically

- [x] Generate builds bounded project context, runs chosen model, validates completed draft, adds whole batch once, and reports counts after flush succeeds.
- [ ] Cancel/project switch/import/reload rejects late events; concurrent edits merge safely and missing references reject batch; duplicate completion never reapplies.
- [x] Auth/model/network/parse errors preserve prompt and workspace; save failure marks batch unsaved and retry saves without another inference request.

Verification: focused asynchronous integration checks with fake agent; existing `npm test`, `npm run build`, Rust tests; native typed prompt → map/list → reopen smoke test.
Dependencies: 2, 3. Medium scope. Likely files: `src/App.tsx`, `src/agent.ts`, `src/planner.ts`, new generation tests, `src/useWorkspace.ts` only if necessary.

## Checkpoint B

- [ ] Typed and dictated requests each create one valid saved batch; cancellation, switched-project, and persistence retry checks pass.

## 5. Undo last generated batch

- [x] Session-scoped Undo removes only recorded generated items/links through latest-state update and flush.
- [x] Unrelated edits survive; edited batch or later dependent manual items/links invalidate Undo without partial deletion.
- [x] New generation replaces Undo entry; save failure remains visible/retryable; restart retains planner content and clears Undo availability.

Verification: focused batch inverse tests covering unrelated edits, modified generated items, external children/links, and failed save retry; native Undo/reopen smoke test.
Dependencies: 4. Medium scope. Likely files: `src/planner.ts`, `src/planner.test.ts`, `src/App.tsx`.

## 6. Verify and document

- [ ] Full native acceptance flow passes with actual available Luna and system dictation, plus Finder launch, cancellation, offline/manual planner, save/reopen, and Undo.
- [x] Setup documents subscription connection, model availability, data sent, dictation shortcut/settings, failure recovery, and same-session Undo limits.
- [x] README/PRODUCT scope matches shipped feature; TypeScript and Rust checks pass.

Verification: `npm test`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, native build/smoke check. Record actual results; do not infer native behavior from browser preview.
Dependencies: 5. Medium scope. Likely files: `README.md`, `PRODUCT.md`, setup notes if needed.

## Completion

- [x] Plan reviewed before implementation begins.
- [ ] All acceptance criteria verified; remaining limitations recorded.

Implementation is complete; unchecked items include live or asynchronous acceptance evidence still pending. Checked feature items describe implemented behavior, not successful live inference. See [verification.md](verification.md).
