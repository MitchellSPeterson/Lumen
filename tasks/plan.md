# Automatic planner creation and system dictation

Status: implemented on `codex/automatic-planner`; packaged native build passes. Live subscription inference and spoken Dictation acceptance remain pending user participation. See [verification.md](verification.md).

## Outcome

User selects a project, types or dictates an idea, chooses a model, and presses Generate. App creates features, nested todos, bugs when requested, and related-item links. Results appear in both map and list, save locally, and offer one-step Undo.

Example prompt: "Plan user accounts with email login, password reset, and account deletion. Break each feature into implementation tasks and connect related work."

## User flow

1. Open a "Plan with AI" composer from the active project's toolbar.
2. On first use, connect ChatGPT subscription through browser sign-in. Show connection status and selected model.
3. Enter an idea in a labeled multiline text field. macOS users can invoke their configured Dictation shortcut while field has focus. Plain Enter inserts a newline; Generate or Cmd+Enter submits only after composition finishes.
4. Default to an available Luna model on first connection. Remember explicit selection; never silently switch to a more expensive model. Model catalog is advisory; an inference request verifies account access.
5. Show "Planning…" with Cancel. Keep prompt available for correction/retry.
6. On successful completion and validation, add the whole batch automatically. Show created counts and reveal generated content without repositioning existing nodes.
7. Report "Saved" only after persistence succeeds. Offer Undo for the last generated batch during this app session, while that batch remains safe to remove.

Dictation hint: "Use your Mac's Dictation shortcut to speak here. Enable it in System Settings → Keyboard → Dictation." Avoid hard-coding Fn shortcuts or displaying a recording state the app cannot observe. macOS handles speech recognition; app receives text. Verify actual native-window behavior before claiming support. [Apple Dictation documentation](https://support.apple.com/guide/mac-help/use-dictation-mh40584/mac).

## Integration

Use installed Codex CLI runtime, launched by Rust as an app-owned `codex app-server` child over stdio. Desktop Codex window need not remain open. Handle GUI launch paths explicitly: discover common installation paths or allow user to select an executable; never interpolate prompts into shell commands.

Preferred authentication for this new integration: app-owned Sign in with ChatGPT session with permission for eligible ChatGPT plan usage. Native backend owns registration, stable host identity, protected credential storage, token refresh, and child process environment. Credentials never enter React, workspace backups, or logs. Existing Codex installation supplies runtime, not permission to copy its private credential files. Confirm subscription eligibility and structured-output support in first implementation milestone. [Plan usage overview](https://developers.openai.com/siwc/token-sharing-open-source), [app-server configuration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server).

Initialize protocol, discover models, start a fresh thread for each request, then start a turn with a strict `outputSchema`. Accept only a completed turn and a complete validated result. Correlate RPC IDs and run IDs; stream status through Tauri events. Support cancellation, bounded time/output, process exit, restart, and cleanup on quit. Keep unfinished output out of workspace. [App-server protocol](https://learn.chatgpt.com/docs/app-server).

Run planner with read-only sandbox and external tools/connectors disabled. Installed CLI 0.159.3 does not support restricting readable roots; use an isolated temporary cwd/HOME/CODEX_HOME, disable tools, and stop unsupported tool actions. Do not claim complete filesystem isolation. Pass project context explicitly; do not launch in selected repository folder or inherit its instructions. Verify effective settings against installed CLI schema before relying on them. Network access to inference service remains necessary.

System dictation fits this route: current ChatGPT plan usage preview accepts text but does not support transcription API/audio inputs. [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

## Context and output contract

Send prompt, project name, existing planner item IDs/titles/kinds/parents/statuses, and related links. Include selected item's notes when selected. Composer states that prompt and project planning context are sent to Codex. Keep context bounded; if project exceeds limit, explain and require narrower selection rather than silently dropping references. No repository scan in this version.

Response is a closed JSON object with `items` and `links`, not an entire Workspace replacement. Each new item has a temporary key, title, kind, priority, tags, notes, and nullable parent reference. References explicitly distinguish `new` keys from `existing` item IDs. Links use the same reference form. App supplies real UUIDs, project ID, timestamps, initial `todo` status, order, and coordinates.

Proposed limits: 8,000-character prompt, 100 new items, 200 links, 1 MiB response. Validate text lengths and total context size at native boundary too. Calibrate against actual model limits during connection milestone.

Reject malformed or extra fields, duplicate temporary keys, unknown references, invalid enums, blank titles, cycles, cross-project references, and self-links. Normalize undirected link pairs; omit duplicates already present. All other validation errors reject whole batch with a useful message. An empty valid result reports no changes.

## Apply, persistence, and undo

Reuse `createItem`, `validateWorkspace`, map layout helpers, `useWorkspace.update`, and `flush`. Existing SQLite save path already validates complete workspace. No new planner database schema needed.

Flush pending edits before generation. Capture target project/run IDs, then merge additions into latest workspace when result arrives. Recheck referenced items and project membership. Cancel generation when active project changes or workspace is imported/reloaded; discard late responses. Allow only one active run and one application of its result.

Assign positions to new nodes only; leave existing coordinates intact. Expand parents needed to reveal new children and clear obstructing filters as existing add-item flow does.

Validate candidate workspace before mutation, update once, then await flush. If save fails, batch remains visibly unsaved and retry saves that same batch. Do not regenerate, duplicate items, or roll back unrelated edits. SQLite retains previous durable state on transaction failure.

Undo records exact created IDs and their applied values in memory. Remove only created items/links; preserve unrelated edits. Invalidate Undo if batch content changes or later manual children/links depend on it. Apply inverse through latest-state update, validate, and flush. New successful generation replaces previous Undo entry. Restart clears Undo; generated planner content remains saved.

## Implementation order

Detailed acceptance criteria and file ownership live in [todo.md](todo.md).

1. Prove subscription connection, model discovery, structured output, and safe process configuration.
2. Build prompt composer and verify native system dictation.
3. Define draft contract, validation, latest-state merge, and map placement with fixtures.
4. Connect Generate to automatic creation, saving, cancellation, and errors.
5. Add batch-scoped Undo.
6. Verify native end-to-end workflow and update product/setup documentation.

## Scope and verification

First version adds planner content only. Existing item edits/deletions, repository implementation, custom microphone recording, persistent AI chat, and persistent undo history stay outside this milestone. Related links remain existing undirected relations, not a new dependency type. Manual planner remains usable offline; generation requires connection.

README.md and PRODUCT.md now describe optional Codex generation; this approved request expands that scope.

Verify with focused Vitest tests for invalid drafts, references, stale results, duplicate delivery, and undo preservation; Rust tests for protocol/process/error handling; existing test suite and builds. Native smoke test must include Finder-launched app, subscription login, real available Luna inference, dictated multiline prompt, cancel, project switch, save failure/retry, Undo, and reopen persistence. Real inference is not part of automated tests.

Remaining evidence to obtain during implementation: account eligibility, actual Luna ID/access, installed runtime support for output schema and tool restrictions, credential-store integration, and Dictation behavior in Tauri WKWebView. Resolve these before building broader UI; no product preference question blocks this plan.

## Implementation evidence

All feature paths are implemented. Connection, composer, merge, persistence, cancellation, and Undo were integrated before live Checkpoint A because account consent and microphone input require the user. This deviates from the proposed gating order; end-to-end acceptance is still pending. Runtime catalog includes `gpt-6-luna`, but account entitlement and real structured output remain unverified. See verification record for exact results.
