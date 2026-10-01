mod db;
mod model;

use model::Workspace;
use std::{fs::File, io::{Read, Write}, path::PathBuf};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use std::sync::atomic::{AtomicBool, Ordering};

struct ExitState(AtomicBool);

const MAX_IMPORT_BYTES: u64 = 10 * 1024 * 1024;

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir()
        .map(|directory| directory.join("planner.sqlite"))
        .map_err(|error| format!("Cannot locate app data directory: {error}"))
}

async fn blocking<T: Send + 'static>(
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("Background operation failed: {error}"))?
}

#[tauri::command]
async fn load_workspace(app: tauri::AppHandle) -> Result<Workspace, String> {
    let path = database_path(&app)?;
    blocking(move || {
        let connection = db::open(&path)?;
        db::load(&connection)
    }).await
}

#[tauri::command]
async fn save_workspace(app: tauri::AppHandle, workspace: Workspace) -> Result<(), String> {
    workspace.validate()?;
    let path = database_path(&app)?;
    blocking(move || {
        let mut connection = db::open(&path)?;
        db::save(&mut connection, &workspace)
    }).await
}

#[tauri::command]
async fn choose_project_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    blocking(move || {
        app.dialog().file().blocking_pick_folder()
            .map(|folder| folder.into_path()
                .map(|path| path.to_string_lossy().into_owned())
                .map_err(|error| format!("Cannot use selected folder: {error}")))
            .transpose()
    }).await
}

#[tauri::command]
async fn inspect_folder(folder: String) -> Result<bool, String> {
    blocking(move || Ok(std::path::Path::new(&folder).is_dir())).await
}

#[tauri::command]
fn finish_quit(app: tauri::AppHandle) {
    app.state::<ExitState>().0.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[tauri::command]
async fn export_workspace(app: tauri::AppHandle) -> Result<Option<String>, String> {
    blocking(move || {
        let selected = app.dialog().file()
            .add_filter("JSON", &["json"])
            .set_file_name("codebase-planner.json")
            .blocking_save_file();
        let Some(selected) = selected else { return Ok(None) };
        let destination = selected.into_path()
            .map_err(|error| format!("Cannot use export location: {error}"))?;
        let path = database_path(&app)?;
        if destination.canonicalize().ok() == path.canonicalize().ok() && path.exists() {
            return Err("Choose a backup file outside the workspace database.".into());
        }
        if destination.file_name().is_some_and(|name| {
            matches!(name.to_str(), Some("planner.sqlite" | "planner.sqlite-wal" | "planner.sqlite-shm" | "planner.sqlite-journal"))
        }) {
            return Err("Choose a .json backup filename.".into());
        }
        let connection = db::open(&path)?;
        let workspace = db::load(&connection)?;
        let json = serde_json::to_vec_pretty(&workspace)
            .map_err(|error| format!("Cannot prepare backup: {error}"))?;
        let parent = destination.parent()
            .ok_or_else(|| "Cannot use export location.".to_string())?;
        let mut temporary = tempfile::NamedTempFile::new_in(parent)
            .map_err(|error| format!("Cannot create backup: {error}"))?;
        temporary.write_all(&json)
            .and_then(|()| temporary.flush())
            .and_then(|()| temporary.as_file().sync_all())
            .map_err(|error| format!("Cannot write backup: {error}"))?;
        temporary.persist(&destination)
            .map_err(|error| format!("Cannot save backup: {error}"))?;
        Ok(Some(destination.to_string_lossy().into_owned()))
    }).await
}

#[tauri::command]
async fn import_workspace(app: tauri::AppHandle) -> Result<Option<Workspace>, String> {
    blocking(move || {
        let selected = app.dialog().file()
            .add_filter("JSON", &["json"])
            .blocking_pick_file();
        let Some(selected) = selected else { return Ok(None) };
        let path = selected.into_path()
            .map_err(|error| format!("Cannot use selected backup: {error}"))?;
        let file = File::open(&path)
            .map_err(|error| format!("Cannot open backup: {error}"))?;
        if file.metadata().map_err(|error| format!("Cannot inspect backup: {error}"))?.len()
            > MAX_IMPORT_BYTES
        {
            return Err("Backup exceeds the 10 MB import limit.".into());
        }
        let mut bytes = Vec::new();
        file.take(MAX_IMPORT_BYTES + 1).read_to_end(&mut bytes)
            .map_err(|error| format!("Cannot read backup: {error}"))?;
        if bytes.len() as u64 > MAX_IMPORT_BYTES {
            return Err("Backup exceeds the 10 MB import limit.".into());
        }
        let workspace: Workspace = serde_json::from_slice(&bytes)
            .map_err(|_| "This is not a version 1 Codebase Planner backup.".to_string())?;
        workspace.validate()?;
        Ok(Some(workspace))
    }).await
}

pub fn run() {
    let result = tauri::Builder::default()
        .manage(ExitState(AtomicBool::new(false)))
        .menu(|app| {
            let menu = tauri::menu::Menu::default(app)?;
            #[cfg(target_os = "macos")]
            if let Some(submenu) = menu.items()?.first().and_then(|item| item.as_submenu()) {
                let items = submenu.items()?;
                if !items.is_empty() {
                    submenu.remove_at(items.len() - 1)?;
                    submenu.append(&tauri::menu::MenuItem::with_id(
                        app, "planner-quit", "Quit Codebase Planner", true, Some("CmdOrCtrl+Q"),
                    )?)?;
                }
            }
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id() == "planner-quit" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("planner-quit-requested", ());
                } else {
                    app.exit(0);
                }
            }
        })
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            choose_project_folder,
            inspect_folder,
            finish_quit,
            export_workspace,
            import_workspace,
        ])
        .build(tauri::generate_context!());
    match result {
        Ok(app) => app.run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<ExitState>().0.load(Ordering::SeqCst) {
                  if let Some(window) = app.get_webview_window("main") {
                    api.prevent_exit();
                    let _ = window.emit("planner-quit-requested", ());
                  }
                }
            }
        }),
        Err(error) => eprintln!("Cannot start Codebase Planner: {error}"),
    }
}
