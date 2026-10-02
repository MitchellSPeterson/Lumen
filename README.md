# Codebase Planner

Local desktop workspace for ideas, features, todos, and bugs. Outline, map, and status board share one set of items. Built with Tauri 2, React, TypeScript, React Flow, and SQLite.

## Run

Requires Node 22.12+ or Node 24+, Rust stable, and Xcode command-line tools on macOS.

```sh
npm install
npm run tauri dev
```

For a browser preview, run `npm run dev` and open http://127.0.0.1:1420. Browser preview uses its own local storage; native folder dialogs and SQLite are available in the desktop app.

## Use

- Create a project, optionally associate a repository folder, and capture a thought in **Add idea**. Enter saves only the title; Cmd/Ctrl+N focuses capture.
- **Inbox** holds top-level ideas. Classify an idea or place it under another item to organize it without duplication.
- **Outline** is the default for new projects. Expand branches, drag rows inside another item, or drop between rows to reorder. The Parent selector and Move up/down buttons offer keyboard alternatives.
- Select sibling checkboxes and choose **Group into feature**. Existing branches and links stay intact.
- **Map** shows relationships. Drag nodes to position them, connect handles to relate items, and double-click titles to rename. Arrange recalculates positions; Fit view frames the map.
- **Board** shows classified items by execution status. Drag cards between columns or use each card's status selector. Now/Next/Later planning is separate from status.
- Select an item to edit its title, notes, children, type, status, parent, and planning horizon. Expand **Feature plan** for the problem, expected behavior, acceptance checks, and open questions; expand **Bug report** for reproduction steps and expected/actual behavior. Acceptance checks never complete tasks or change status automatically. Planning details remain saved when changing types.
- Add tasks and bugs directly from item details. The project Bugs view includes nested bugs. Search includes notes, tags, and structured planning details; matching descendants retain ancestor context.
- Tags, priority, related items, and extra filters are expandable. Cmd/Ctrl+K opens search and actions.
- Open **Settings** for appearance, ChatGPT/Codex connection, default model, executable path, backups, and dictation guidance.
- Export a JSON backup from the sidebar. Import creates independent project copies with new IDs. Existing version 1 backups and storage upgrade to version 2 automatically.

Autosave shows save status in the header. Failed writes retain pending changes in memory and offer Retry. Both closing the window and quitting wait for pending writes. Blank item titles keep their previous saved value.

The optional playground contains illustrative sample work. Repository association never edits or scans repository files.

## Plan with Codex

In the desktop app, open a project and choose **Plan with AI**. Install Codex CLI if needed, then open **Connection settings → Continue with ChatGPT** to connect your subscription in the system browser. This app registers its own connection; an existing Codex desktop sign-in is not automatically shared. The saved connection restores when Settings or the planner composer first opens. **Sign out** removes the local session and requests remote revocation; if revocation fails, disconnect the app in ChatGPT Settings. If the executable cannot be found, set its path in **Settings → ChatGPT & Codex** and restart the app. This path and the default model stay remembered across app restarts; an empty path uses automatic discovery.

Type an idea or focus the prompt field and use your configured macOS Dictation shortcut. Enable Dictation in System Settings → Keyboard → Dictation. Enter adds a newline; Generate plan or Cmd+Enter submits text. Speech recognition is handled by macOS. The packaged app exposes Edit → Start Dictation; live speech input still needs an on-device acceptance check. Browser preview displays the composer but cannot connect to Codex.

Luna is selected when present in the model catalog. An explicit selection stays remembered, and the app never silently chooses a different model. Catalog entries do not guarantee account access; each request checks access and consumes your plan allowance. Subscription sign-in and inference follow OpenAI's current [Sign in with ChatGPT plan usage](https://developers.openai.com/siwc/token-sharing-open-source) availability.

Generation sends your prompt and project planning context to Codex. Selecting an item before opening the composer narrows context to its branch, ancestors, and directly related items. Repository files are not read or changed. Generation opens an editable proposal without changing planning data. Review item titles, types, notes, planning details, parent references, and links, then choose **Apply** or **Discard**. Selected-item actions offer **Clarify idea**, **Find missing requirements**, and **Break into tasks**. Updates are limited to the selected item's notes and planning details. If the selected item changes before Apply, generate again.

Cancel stops an active request; changing projects or importing a backup discards late results. If saving fails, use **Retry save** to persist the existing batch without another model request. **Undo AI batch** removes the last generated additions and safely restores reviewed planning edits during this app session. Undo becomes unavailable after its generated items or updated fields change, or later items/links depend on it; restarting clears Undo availability.

App-owned credentials are stored separately from planner backups in an owner-only session file under the native app data directory. AI generation requires internet access; manual planning remains available offline. Prompt limit is 8,000 characters, with up to 100 generated items and 200 related links per request.

## Storage and build

Native data lives in `~/Library/Application Support/com.codebaseplanner.desktop/planner.sqlite`. Database migrations and writes use transactions. Backups include projects, items, related links, view mode, viewport, collapsed branches, and map coordinates.

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build -- --bundles app
```

The unsigned app bundle is `src-tauri/target/release/bundle/macos/Codebase Planner.app`. No developer certificate is required to run this local build. Distribution signing and notarization are not configured.

Vite uses its runner config loader and a polling watcher to avoid native filesystem watcher stalls on this Mac. Package and Cargo lockfiles record the installed versions.

The app is single-user and macOS-first, with light/dark appearance and local planning storage. Optional Codex generation requires a subscription connection. GitHub sync, repository scanning, due dates, and automatic status rollups are outside this version.
