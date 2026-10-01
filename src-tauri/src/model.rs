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
            version: 1,
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
        if self.version != 1 {
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
                || !matches!(item.kind.as_str(), "todo" | "feature" | "bug")
                || !matches!(item.status.as_str(), "todo" | "in_progress" | "done")
                || !matches!(item.priority.as_str(), "low" | "normal" | "high")
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
                || !matches!(view.mode.as_str(), "map" | "list")
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
