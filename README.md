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

V1 is single-user, offline, light-theme, and macOS-first. No AI, GitHub sync, repository scanning, kanban, due dates, or automatic status rollups.
