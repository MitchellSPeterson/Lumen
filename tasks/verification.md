# Automatic planner verification

Implementation finished on `codex/automatic-planner`. Live acceptance remains pending.

## Passed

- `npm test`: 27 tests across 4 files; includes 7 planner tests for strict/atomic validation, nested layout, bounded context/output, selected scope, and safe Undo.
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
