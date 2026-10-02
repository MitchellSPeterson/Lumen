# Automatic planner verification

Implementation finished on `codex/automatic-planner`. Live acceptance remains pending.

## Passed

- `npm test`: 28 tests across 4 files; includes 8 planner tests for strict/atomic validation, nested layout, bounded context/output, selected scope, and safe Undo.
- `npm run build`: TypeScript and production bundle pass. Existing bundle-size warning remains (about 631 kB main chunk).
- `cargo test --manifest-path src-tauri/Cargo.toml --lib -q`: 10 tests pass, including fake-child protocol buffering, bounded messages, immediate cancellation, and protected credential-file checks.
- `cargo check --all-targets`: passed during backend integration.
- `npm run tauri build -- --bundles app`: unsigned macOS bundle produced.
- Installed Codex CLI 0.159.3 strict-config smoke: initialize, model/list, and ephemeral thread/start pass with dummy token. Catalog includes `gpt-6-luna`. This does not verify account entitlement or inference.
- Effective runtime config: dedicated ChatGPT provider, read-only sandbox, shell/web/apps/hooks/multi-agent/code mode disabled. Separate temporary cwd/HOME/CODEX_HOME; selected repository path is never passed. Protocol rejects all item types except user/agent messages and reasoning.
- Packaged application launched through macOS app launching. Native composer accepts multiline text; Enter inserts newline and Cmd+Enter does not generate while disconnected. Connect discovers installed runtime and requests app-owned ChatGPT sign-in. Closing/reopening composer preserves draft. Edit menu exposes Start Dictation while prompt is focused.
- Browser preview: native connection/generation disabled, multiline prompt retained, labeled controls and dialog displayed. Temporary browser test tab closed.
- `git diff --check`: passed.

## Pending live acceptance

User must complete **Continue with ChatGPT** account consent in the packaged app. Then test:

1. Available Luna request creates one saved batch, appears in map/list, survives app restart.
2. Dictated multiline text can be edited and submitted; composition never submits early.
3. Cancel and project switch discard late completion; concurrent manual edits survive. Native cancellation is unit-tested, but full UI race flow is not automated.
4. Failed save retains generated batch; Retry save persists it without another inference. Same-session Undo removes only that batch, and reopened content reflects the inverse. These paths are implemented; save-failure UI acceptance remains pending.
5. Sign out removes local session and requests remote revocation; stale entitlement/token errors remain actionable.

No real OAuth consent, authenticated inference, microphone input, or generated-content persistence smoke was performed. Async frontend integration tests are not yet present. Installed protocol lacks restricted readable roots, so complete filesystem isolation is not claimed. Disabled tools and isolated home do not prove that a future runtime cannot expose other read capabilities.

## Artifacts

Bundle: `src-tauri/target/release/bundle/macos/Codebase Planner.app`.
Native composer screenshot: `/Users/mitchell/.codex/visualizations/2026/10/02/01a0fa4c-b65f-7af0-be5b-895628ada82c/native-planner.png`.
Browser composer screenshot: `/Users/mitchell/.codex/visualizations/2026/10/02/01a0fa4c-b65f-7af0-be5b-895628ada82c/planner-composer.jpg`.

## Live schema correction acceptance

User encountered `invalid_json_schema`: parent reference discriminators lacked a JSON `type`. Both now use `type: string` with single-value enums. Added recursive strict-schema regression coverage. Production TypeScript build and macOS bundle pass.

Restored the user’s dashboard prompt after loading the corrected build, reconnected the existing app-owned session, and retried with `gpt-6-luna`. Request succeeded: one analytics-dashboard feature with four nested todos, shown in the map; Save status reports Saved locally and Undo AI batch is available. Read-only SQLite verification confirms all five records are durable. No extra inference was issued. Live spoken Dictation, cancellation race, failed-save retry, and Undo remain pending.

Successful map screenshot: `/Users/mitchell/.codex/visualizations/2026/10/02/01a0fa4c-b65f-7af0-be5b-895628ada82c/dashboard-plan-fixed.png`. Earlier pending-live notes describe the initial build; this live correction verifies Luna inference and saved typed-prompt creation.

## Settings panel acceptance

Consolidated Appearance, ChatGPT & Codex, and General sections behind sidebar/header Settings and Cmd+Comma. Authentication actions moved from the planner composer; Connection settings opens the panel and returns to the preserved prompt. Default model stays remembered, and optional executable path now persists locally. Clearing the path and reconnecting resets native cached discovery. Credentials remain native-only, separate from preferences and backups.

`npm test` (28 tests), production TypeScript build, Rust library tests (10 tests), and packaged macOS build pass. Native UI confirms all three sections, saved account/model restoration, custom-path reconnect, theme/path retention across app restart, automatic-discovery reconnect after clearing the path, and prompt preservation on Settings round trip. Keyboard Cmd+Comma opens Settings; Shift+Tab from Close wraps to the last appearance control, then Tab returns to Close. Restored original light/blue appearance and empty path after verification. Existing planner item count stayed at 10. No new inference, sign-out, backup import/export, or microphone action was performed.

Screenshot: `/Users/mitchell/.codex/visualizations/2026/10/02/01a0fa4c-b65f-7af0-be5b-895628ada82c/settings-panel.png`.
