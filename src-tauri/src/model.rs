use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub folder: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkItem {
    pub id: String,
    pub project_id: String,
    pub parent_id: Option<String>,
    pub order: f64,
    pub title: String,
    pub kind: String,
    pub status: String,
    pub priority: String,
    pub tags: Vec<String>,
    pub notes: String,
    pub planning_lane: Option<String>,
    pub details: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatedLink {
    pub id: String,
    pub project_id: String,
    pub source_id: String,
    pub target_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Viewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ProjectView {
    pub mode: String,
    pub collapsed: Vec<String>,
    pub viewport: Viewport,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub version: u32,
    pub projects: Vec<Project>,
    pub items: Vec<WorkItem>,
    pub links: Vec<RelatedLink>,
    pub views: HashMap<String, ProjectView>,
    pub active_project_id: Option<String>,
}

impl Default for Workspace {
    fn default() -> Self {
        Self {
            version: 2,
            projects: Vec::new(),
            items: Vec::new(),
            links: Vec::new(),
            views: HashMap::new(),
            active_project_id: None,
        }
    }
}

impl Workspace {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != 2 {
            return Err("Unsupported workspace version.".into());
        }

        let mut projects = HashSet::new();
        for project in &self.projects {
            if project.id.is_empty() || !projects.insert(project.id.as_str())
                || project.name.trim().is_empty()
            {
                return Err("Workspace contains an invalid project.".into());
            }
        }

        let mut items = HashMap::new();
        for item in &self.items {
            if item.id.is_empty() || items.insert(item.id.as_str(), item).is_some()
                || !projects.contains(item.project_id.as_str())
                || item.title.trim().is_empty()
                || !matches!(item.kind.as_str(), "idea" | "todo" | "feature" | "bug")
                || !matches!(item.status.as_str(), "todo" | "in_progress" | "done")
                || !matches!(item.priority.as_str(), "low" | "normal" | "high")
                || item.planning_lane.as_deref().is_some_and(|lane| !matches!(lane, "now" | "next" | "later"))
                || !valid_details(&item.details)
                || !item.order.is_finite() || !item.x.is_finite() || !item.y.is_finite()
            {
                return Err("Workspace contains an invalid item.".into());
            }
        }

        for item in &self.items {
            let mut seen = HashSet::new();
            let mut parent_id = item.parent_id.as_deref();
            while let Some(id) = parent_id {
                if !seen.insert(id) {
                    return Err("Workspace contains a parent cycle.".into());
                }
                let parent = items.get(id)
                    .ok_or_else(|| "Workspace references a missing parent item.".to_string())?;
                if parent.project_id != item.project_id {
                    return Err("Workspace contains a cross-project parent.".into());
                }
                parent_id = parent.parent_id.as_deref();
            }
        }

        let mut links = HashSet::new();
        let mut pairs = HashSet::new();
        for link in &self.links {
            let source = items.get(link.source_id.as_str());
            let target = items.get(link.target_id.as_str());
            let pair = if link.source_id < link.target_id {
                (link.source_id.as_str(), link.target_id.as_str())
            } else {
                (link.target_id.as_str(), link.source_id.as_str())
            };
            if link.id.is_empty() || !links.insert(link.id.as_str())
                || source.is_none() || target.is_none()
                || link.source_id == link.target_id || !pairs.insert(pair)
                || source.is_some_and(|item| item.project_id != link.project_id)
                || target.is_some_and(|item| item.project_id != link.project_id)
            {
                return Err("Workspace contains an invalid related link.".into());
            }
        }

        if self.active_project_id.as_ref().is_some_and(|id| !projects.contains(id.as_str())) {
            return Err("Workspace references a missing active project.".into());
        }
        for (project_id, view) in &self.views {
            if !projects.contains(project_id.as_str())
                || !matches!(view.mode.as_str(), "outline" | "map" | "board")
                || !view.viewport.x.is_finite() || !view.viewport.y.is_finite()
                || !view.viewport.zoom.is_finite() || view.viewport.zoom <= 0.0
                || view.collapsed.iter().any(|id| {
                    items.get(id.as_str()).is_none_or(|item| item.project_id != *project_id)
                })
            {
                return Err("Workspace contains an invalid project view.".into());
            }
        }
        Ok(())
    }
}

fn valid_details(value: &serde_json::Value) -> bool {
    let Some(details) = value.as_object() else { return false };
    if let Some(feature) = details.get("feature") {
        let Some(feature) = feature.as_object() else { return false };
        if ["problem", "expectedBehavior", "openQuestions"].iter().any(|key| !feature.get(*key).is_some_and(|value| value.is_string())) { return false; }
        let Some(criteria) = feature.get("acceptanceCriteria").and_then(|value| value.as_array()) else { return false };
        let mut ids = HashSet::new();
        for criterion in criteria {
            let Some(id) = criterion.get("id").and_then(|value| value.as_str()) else { return false };
            if id.is_empty() || !ids.insert(id) || !criterion.get("text").is_some_and(|value| value.is_string()) || !criterion.get("checked").is_some_and(|value| value.is_boolean()) { return false; }
        }
    }
    if let Some(bug) = details.get("bug") {
        let Some(bug) = bug.as_object() else { return false };
        if ["stepsToReproduce", "expectedBehavior", "actualBehavior"].iter().any(|key| !bug.get(*key).is_some_and(|value| value.is_string())) { return false; }
    }
    true
}

pub fn from_backup(bytes: &[u8]) -> Result<Workspace, String> {
    let mut value: serde_json::Value = serde_json::from_slice(bytes)
        .map_err(|_| "This is not a Codebase Planner backup.".to_string())?;
    let version = value.get("version").and_then(|value| value.as_u64());
    if !matches!(version, Some(1 | 2)) { return Err("Unsupported workspace version.".into()); }
    if version == Some(1) {
        value["version"] = serde_json::json!(2);
        if let Some(items) = value.get_mut("items").and_then(|value| value.as_array_mut()) {
            for item in items {
                if let Some(item) = item.as_object_mut() {
                    item.entry("planningLane").or_insert(serde_json::Value::Null);
                    item.entry("details").or_insert(serde_json::json!({}));
                }
            }
        }
        if let Some(views) = value.get_mut("views").and_then(|value| value.as_object_mut()) {
            for view in views.values_mut() {
                if view.get("mode").and_then(|value| value.as_str()) == Some("list") {
                    view["mode"] = serde_json::json!("outline");
                }
            }
        }
    }
    if value.get("activeProjectId").is_none() { return Err("Backup is missing the active project field.".into()); }
    if value.get("items").and_then(|value| value.as_array()).is_some_and(|items| items.iter().any(|item| item.get("parentId").is_none() || item.get("planningLane").is_none() || item.get("details").is_none())) {
        return Err("Backup contains an invalid item.".into());
    }
    let workspace: Workspace = serde_json::from_value(value)
        .map_err(|_| "Backup contains malformed workspace fields.".to_string())?;
    workspace.validate()?;
    Ok(workspace)
}
