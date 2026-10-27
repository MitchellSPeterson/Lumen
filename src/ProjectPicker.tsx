import { Folder } from 'lucide-react';
import type { Project } from './domain';
import { Dropdown } from './Dropdown';

export function ProjectPicker({ projects, activeProjectId, onSelect }: { projects: Project[]; activeProjectId?: string; onSelect: (id: string) => void }) {
  const project = projects.find(entry => entry.id === activeProjectId) ?? projects[0];
  if (!project) return null;
  return <Dropdown className="project-picker" value={project.id} options={projects.map(entry => ({ value: entry.id, label: entry.name, icon: entry.image ? <img className="project-picker-image" src={entry.image} alt="" /> : <Folder size={16} aria-hidden="true" /> }))} onChange={onSelect} label={`Switch project: ${project.name}`} title={project.name} />;
}
