# Codebase Planner

Local desktop workspace for codebase features, todos, and bugs. Mind map and list share one set of items. Built with Tauri 2, React, TypeScript, React Flow, and SQLite.

## Run

Requires Node 22.12+ or Node 24+, Rust stable, and Xcode command-line tools on macOS.

```sh
npm install
npm run tauri dev
```

For a browser preview, run `npm run dev` and open http://127.0.0.1:1420. Browser preview uses its own local storage; native folder dialogs and SQLite are available in the desktop app.

## Use

- Create a project, optionally associate a repository folder, and add a todo, feature, or bug.
- Select an item in the outline, map, or list to edit its status, priority, tags, parent, and Markdown notes.
- Add child todos with the item's plus button. Drag nodes to move them. Drag between handles to relate items. Double-click a map title to rename it.
- Change hierarchy in the Parent selector. Collapse branches in the outline or map. Arrange recalculates positions; Fit view frames the visible map.
- Search titles and notes; filter by type, status, priority, and tags. Cmd+N creates a todo; Cmd+K opens search and actions.
- Export a JSON backup from the sidebar. Import creates independent project copies with new IDs.

Autosave shows save status in the header. Failed writes retain pending changes in memory and offer Retry. Both closing the window and quitting wait for pending writes. Blank item titles keep their previous saved value.

The optional playground contains illustrative sample work. Repository association never edits or scans repository files.

## Plan with Codex

In the desktop app, open a project and choose **Plan with AI**. Install Codex CLI if needed, then choose **Continue with ChatGPT** to connect your subscription in the system browser. This app registers its own connection; an existing Codex desktop sign-in is not automatically shared. Later, **Connect Codex** restores the saved connection. **Sign out** removes the local session and requests remote revocation; if revocation fails, disconnect the app in ChatGPT Settings. If the executable cannot be found, expand **Codex location** and enter its path.

Type an idea or focus the prompt field and use your configured macOS Dictation shortcut. Enable Dictation in System Settings → Keyboard → Dictation. Enter adds a newline; Generate plan or Cmd+Enter submits text. Speech recognition is handled by macOS. The packaged app exposes Edit → Start Dictation; live speech input still needs an on-device acceptance check. Browser preview displays the composer but cannot connect to Codex.

Luna is selected when present in the model catalog. An explicit selection stays remembered, and the app never silently chooses a different model. Catalog entries do not guarantee account access; each request checks access and consumes your plan allowance. Subscription sign-in and inference follow OpenAI's current [Sign in with ChatGPT plan usage](https://developers.openai.com/siwc/token-sharing-open-source) availability.

Generation sends your prompt and project planning context to Codex. Selecting an item before opening the composer narrows context to its branch, ancestors, and directly related items. Repository files are not read or changed. Completed, valid results add features, todos, bugs, and related links as one batch. Existing records and map positions stay intact.

Cancel stops an active request; changing projects or importing a backup discards late results. If saving fails, use **Retry save** to persist the existing batch without another model request. **Undo AI batch** removes only the last generated batch during this app session. Undo becomes unavailable after its items change or later manual items/links depend on it; restarting clears Undo availability.

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

The app is single-user and macOS-first, with light/dark appearance and local planning storage. Optional Codex generation requires a subscription connection. GitHub sync, repository scanning, kanban, due dates, and automatic status rollups are outside this version.
