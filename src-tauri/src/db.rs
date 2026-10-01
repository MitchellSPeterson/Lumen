use crate::model::{Project, ProjectView, RelatedLink, Viewport, WorkItem, Workspace};
use rusqlite::{params, Connection};
use std::{collections::HashMap, fs, path::Path, time::Duration};

const SCHEMA_VERSION: i64 = 1;

fn database_error(error: impl std::fmt::Display) -> String {
    format!("Workspace database error: {error}")
}

pub fn open(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(database_error)?;
    }
    let mut connection = Connection::open(path).map_err(database_error)?;
    connection.busy_timeout(Duration::from_secs(5)).map_err(database_error)?;
    migrate(&mut connection)?;
    Ok(connection)
}

fn migrate(connection: &mut Connection) -> Result<(), String> {
    connection.pragma_update(None, "foreign_keys", "ON").map_err(database_error)?;
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(database_error)?;
    if version > SCHEMA_VERSION {
        return Err("This workspace database was created by a newer version of Codebase Planner.".into());
    }
    if version == SCHEMA_VERSION {
        return Ok(());
    }

    let transaction = connection.transaction().map_err(database_error)?;
    transaction.execute_batch(
        "CREATE TABLE metadata (
           key TEXT PRIMARY KEY,
           value TEXT NOT NULL
         );
         CREATE TABLE projects (
           id TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           folder TEXT NOT NULL,
           created_at TEXT NOT NULL,
           sort_index INTEGER NOT NULL
         );
         CREATE TABLE items (
           id TEXT PRIMARY KEY,
           project_id TEXT NOT NULL REFERENCES projects(id),
           parent_id TEXT REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED,
           sort_index INTEGER NOT NULL,
           item_order REAL NOT NULL,
           title TEXT NOT NULL,
           kind TEXT NOT NULL,
           status TEXT NOT NULL,
           priority TEXT NOT NULL,
           tags TEXT NOT NULL,
           notes TEXT NOT NULL,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL,
           x REAL NOT NULL,
           y REAL NOT NULL
         );
         CREATE TABLE links (
           id TEXT PRIMARY KEY,
           project_id TEXT NOT NULL REFERENCES projects(id),
           source_id TEXT NOT NULL REFERENCES items(id),
           target_id TEXT NOT NULL REFERENCES items(id),
           sort_index INTEGER NOT NULL
         );
         CREATE TABLE view_state (
           project_id TEXT PRIMARY KEY REFERENCES projects(id),
           mode TEXT NOT NULL,
           x REAL NOT NULL,
           y REAL NOT NULL,
           zoom REAL NOT NULL
         );
         CREATE TABLE view_collapsed (
           project_id TEXT NOT NULL REFERENCES view_state(project_id),
           item_id TEXT NOT NULL REFERENCES items(id),
           sort_index INTEGER NOT NULL,
           PRIMARY KEY(project_id, sort_index)
         );
         INSERT INTO metadata(key, value) VALUES ('schema_version', '1'), ('active_project_id', '');
         PRAGMA user_version = 1;"
    ).map_err(database_error)?;
    transaction.commit().map_err(database_error)
}

pub fn save(connection: &mut Connection, workspace: &Workspace) -> Result<(), String> {
    workspace.validate()?;
    let transaction = connection.transaction().map_err(database_error)?;
    transaction.execute_batch(
        "DELETE FROM view_collapsed;
         DELETE FROM view_state;
         DELETE FROM links;
         DELETE FROM items;
         DELETE FROM projects;"
    ).map_err(database_error)?;

    for (index, project) in workspace.projects.iter().enumerate() {
        transaction.execute(
            "INSERT INTO projects(id, name, folder, created_at, sort_index) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![project.id, project.name, project.folder, project.created_at, index as i64],
        ).map_err(database_error)?;
    }
    for (index, item) in workspace.items.iter().enumerate() {
        let tags = serde_json::to_string(&item.tags).map_err(database_error)?;
        transaction.execute(
            "INSERT INTO items(id, project_id, parent_id, sort_index, item_order, title, kind, status, priority, tags, notes, created_at, updated_at, x, y)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![item.id, item.project_id, item.parent_id, index as i64, item.order, item.title,
                item.kind, item.status, item.priority, tags, item.notes, item.created_at,
                item.updated_at, item.x, item.y],
        ).map_err(database_error)?;
    }
    for (index, link) in workspace.links.iter().enumerate() {
        transaction.execute(
            "INSERT INTO links(id, project_id, source_id, target_id, sort_index) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![link.id, link.project_id, link.source_id, link.target_id, index as i64],
        ).map_err(database_error)?;
    }
    for (project_id, view) in &workspace.views {
        transaction.execute(
            "INSERT INTO view_state(project_id, mode, x, y, zoom) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![project_id, view.mode, view.viewport.x, view.viewport.y, view.viewport.zoom],
        ).map_err(database_error)?;
        for (index, item_id) in view.collapsed.iter().enumerate() {
            transaction.execute(
                "INSERT INTO view_collapsed(project_id, item_id, sort_index) VALUES (?1, ?2, ?3)",
                params![project_id, item_id, index as i64],
            ).map_err(database_error)?;
        }
    }
    transaction.execute(
        "UPDATE metadata SET value = ?1 WHERE key = 'active_project_id'",
        params![workspace.active_project_id.as_deref().unwrap_or("")],
    ).map_err(database_error)?;
    transaction.commit().map_err(database_error)
}

pub fn load(connection: &Connection) -> Result<Workspace, String> {
    let transaction = connection.unchecked_transaction().map_err(database_error)?;
    let connection = &*transaction;
    let projects = {
        let mut statement = connection.prepare(
            "SELECT id, name, folder, created_at FROM projects ORDER BY sort_index"
        ).map_err(database_error)?;
        let projects = statement.query_map([], |row| Ok(Project {
            id: row.get(0)?, name: row.get(1)?, folder: row.get(2)?, created_at: row.get(3)?,
        })).map_err(database_error)?.collect::<Result<Vec<_>, _>>().map_err(database_error)?;
        projects
    };
    let items = {
        let mut statement = connection.prepare(
            "SELECT id, project_id, parent_id, item_order, title, kind, status, priority, tags,
                    notes, created_at, updated_at, x, y FROM items ORDER BY sort_index"
        ).map_err(database_error)?;
        let rows = statement.query_map([], |row| Ok((
            row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?,
            row.get::<_, f64>(3)?, row.get::<_, String>(4)?, row.get::<_, String>(5)?,
            row.get::<_, String>(6)?, row.get::<_, String>(7)?, row.get::<_, String>(8)?,
            row.get::<_, String>(9)?, row.get::<_, String>(10)?, row.get::<_, String>(11)?,
            row.get::<_, f64>(12)?, row.get::<_, f64>(13)?,
        ))).map_err(database_error)?;
        let mut items = Vec::new();
        for row in rows {
            let (id, project_id, parent_id, order, title, kind, status, priority, tags,
                notes, created_at, updated_at, x, y) = row.map_err(database_error)?;
            items.push(WorkItem {
                id, project_id, parent_id, order, title, kind, status, priority,
                tags: serde_json::from_str(&tags).map_err(database_error)?,
                notes, created_at, updated_at, x, y,
            });
        }
        items
    };
    let links = {
        let mut statement = connection.prepare(
            "SELECT id, project_id, source_id, target_id FROM links ORDER BY sort_index"
        ).map_err(database_error)?;
        let links = statement.query_map([], |row| Ok(RelatedLink {
            id: row.get(0)?, project_id: row.get(1)?, source_id: row.get(2)?, target_id: row.get(3)?,
        })).map_err(database_error)?.collect::<Result<Vec<_>, _>>().map_err(database_error)?;
        links
    };
    let mut views = HashMap::new();
    {
        let mut statement = connection.prepare(
            "SELECT project_id, mode, x, y, zoom FROM view_state"
        ).map_err(database_error)?;
        let rows = statement.query_map([], |row| Ok((
            row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?,
            row.get::<_, f64>(3)?, row.get::<_, f64>(4)?,
        ))).map_err(database_error)?;
        for row in rows {
            let (project_id, mode, x, y, zoom) = row.map_err(database_error)?;
            views.insert(project_id, ProjectView {
                mode, collapsed: Vec::new(), viewport: Viewport { x, y, zoom },
            });
        }
    }
    {
        let mut statement = connection.prepare(
            "SELECT project_id, item_id FROM view_collapsed ORDER BY project_id, sort_index"
        ).map_err(database_error)?;
        let rows = statement.query_map([], |row| Ok((
            row.get::<_, String>(0)?, row.get::<_, String>(1)?,
        ))).map_err(database_error)?;
        for row in rows {
            let (project_id, item_id) = row.map_err(database_error)?;
            views.get_mut(&project_id)
                .ok_or_else(|| "Workspace database contains an orphaned map view.".to_string())?
                .collapsed.push(item_id);
        }
    }
    let active_project_id: String = connection.query_row(
        "SELECT value FROM metadata WHERE key = 'active_project_id'", [], |row| row.get(0)
    ).map_err(database_error)?;
    let workspace = Workspace {
        version: 1, projects, items, links, views,
        active_project_id: if active_project_id.is_empty() { None } else { Some(active_project_id) },
    };
    workspace.validate()?;
    transaction.commit().map_err(database_error)?;
    Ok(workspace)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn sample() -> Workspace {
        let project = Project {
            id: "project-a".into(), name: "Alpha".into(), folder: "/tmp/alpha".into(),
            created_at: "2026-10-01T00:00:00Z".into(),
        };
        let item = |id: &str, parent_id: Option<&str>, project_id: &str| WorkItem {
            id: id.into(), project_id: project_id.into(), parent_id: parent_id.map(str::to_owned),
            order: 1.5, title: id.into(), kind: "feature".into(), status: "in_progress".into(),
            priority: "high".into(), tags: vec!["rust".into()], notes: "note".into(),
            created_at: "2026-10-01T00:00:00Z".into(), updated_at: "2026-10-01T00:00:00Z".into(),
            x: 20.0, y: 30.0,
        };
        Workspace {
            version: 1, projects: vec![project],
            items: vec![item("child", Some("root"), "project-a"), item("root", None, "project-a")],
            links: vec![RelatedLink {
                id: "related".into(), project_id: "project-a".into(),
                source_id: "child".into(), target_id: "root".into(),
            }],
            views: HashMap::from([("project-a".into(), ProjectView {
                mode: "map".into(), collapsed: vec!["root".into()],
                viewport: Viewport { x: 40.0, y: 50.0, zoom: 0.8 },
            })]),
            active_project_id: Some("project-a".into()),
        }
    }

    #[test]
    fn round_trip_persists_hierarchy_and_camel_case_backup() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("planner.sqlite");
        let mut connection = open(&path).unwrap();
        save(&mut connection, &sample()).unwrap();
        drop(connection);
        let connection = open(&path).unwrap();
        let loaded = load(&connection).unwrap();
        let json = serde_json::to_value(&loaded).unwrap();
        assert_eq!(json["activeProjectId"], "project-a");
        assert_eq!(json["items"][0]["parentId"], "root");
        assert_eq!(json["items"][0]["projectId"], "project-a");
        assert_eq!(json["views"]["project-a"]["collapsed"][0], "root");
        assert_eq!(json["links"][0]["sourceId"], "child");
    }

    #[test]
    fn invalid_save_preserves_previous_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let mut connection = open(&directory.path().join("planner.sqlite")).unwrap();
        save(&mut connection, &sample()).unwrap();
        let mut invalid = sample();
        invalid.items[1].parent_id = Some("child".into());
        assert!(save(&mut connection, &invalid).unwrap_err().contains("cycle"));
        let loaded = load(&connection).unwrap();
        assert_eq!(loaded.items[1].parent_id, None);
        assert_eq!(loaded.links.len(), 1);
    }

    #[test]
    fn cross_project_references_are_rejected() {
        let mut workspace = sample();
        workspace.projects.push(Project {
            id: "project-b".into(), name: "Beta".into(), folder: "/tmp/beta".into(),
            created_at: "2026-10-01T00:00:00Z".into(),
        });
        workspace.items[0].project_id = "project-b".into();
        assert!(workspace.validate().unwrap_err().contains("cross-project parent"));
        workspace.items[0].parent_id = None;
        assert!(workspace.validate().unwrap_err().contains("related link"));
        workspace.links.clear();
        workspace.views.get_mut("project-a").unwrap().collapsed = vec!["child".into()];
        assert!(workspace.validate().unwrap_err().contains("project view"));
    }

    #[test]
    fn future_schema_is_rejected_without_changes() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.pragma_update(None, "user_version", 2).unwrap();
        assert!(migrate(&mut connection).unwrap_err().contains("newer version"));
        let version: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
        assert_eq!(version, 2);
    }
}
