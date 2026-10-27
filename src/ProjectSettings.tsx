import { useEffect, useRef, useState } from 'react';
import { Folder, FolderOpen, Trash2 } from 'lucide-react';
import { projectImageMaxLength, validProjectImage, type Project } from './domain';
import { chooseFolder, native } from './persistence';

type Props = {
  project: Project;
  onSave(patch: Pick<Project, 'name' | 'folder' | 'image'>): Promise<void>;
  onDelete(): void;
};

export function ProjectSettings({ project, onSave, onDelete }: Props) {
  const [name, setName] = useState(project.name);
  const [folder, setFolder] = useState(project.folder);
  const [image, setImage] = useState(project.image);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  function selectImage(file?: File) {
    if (!file) return;
    setError(''); setMessage('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Choose a PNG, JPEG, WebP, or GIF image.'); return;
    }
    if (file.size > 2 * 1024 * 1024) { setError('Choose an image smaller than 2 MB.'); return; }
    const token = ++request.current;
    setReading(true);
    const reader = new FileReader();
    const fail = () => {
      if (token !== request.current) return;
      setReading(false); setError('Could not read this image. Choose another file.');
    };
    reader.onerror = fail;
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== 'string' || value.length > projectImageMaxLength || !validProjectImage(value)) { fail(); return; }
      const preview = new Image();
      preview.onerror = fail;
      preview.onload = () => {
        if (token !== request.current) return;
        setImage(value); setReading(false);
      };
      preview.src = value;
    };
    reader.readAsDataURL(file);
  }

  return <form className="project-settings" onSubmit={async event => {
    event.preventDefault();
    if (!name.trim() || reading || saving) return;
    setSaving(true); setError(''); setMessage('');
    try { await onSave({ name: name.trim(), folder, image }); setName(name.trim()); setMessage('Project settings saved.'); }
    catch (problem) { setError(`Could not save project settings: ${problem instanceof Error ? problem.message : String(problem)}`); }
    finally { setSaving(false); }
  }}>
    <h2>Project settings</h2>
    <p className="form-hint">Edit the current project. Changes apply when you save.</p>
    <fieldset className="project-image-field" disabled={saving || reading}>
      <legend>Project image</legend>
      <div className="project-image-controls">
        <div className="project-image-preview">{image ? <img src={image} alt="Project image preview" /> : <Folder size={28} aria-hidden="true" />}</div>
        <div><div className="settings-buttons">
          <button type="button" className="secondary-button" onClick={() => imageInput.current?.click()}>{reading ? 'Reading image…' : image ? 'Change image' : 'Add image'}</button>
          {image && <button type="button" className="text-button" onClick={() => { setImage(undefined); setMessage(''); }}>Remove image</button>}
        </div><p className="form-hint" id="project-image-hint">PNG, JPEG, WebP, or GIF. Up to 2 MB. Included in backups.</p></div>
      </div>
      <input ref={imageInput} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose project image" aria-describedby="project-image-hint" onChange={event => { selectImage(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
    </fieldset>
    <label className="form-field">Project name<input required maxLength={200} value={name} disabled={saving} onChange={event => { setName(event.currentTarget.value); setMessage(''); }} /></label>
    <label className="form-field">Repository folder<span className="folder-picker">
      <input aria-label="Repository folder" maxLength={4096} value={folder} disabled={saving} placeholder={native ? 'Choose a local repository' : 'Optional path for browser preview'} readOnly={native} onChange={event => { setFolder(event.currentTarget.value); setMessage(''); }} />
      <button type="button" className="secondary-button" disabled={!native || saving} aria-label="Choose repository folder" onClick={async () => {
        try { const chosen = await chooseFolder(); if (chosen) { setFolder(chosen); setMessage(''); setError(''); } }
        catch (problem) { setError(problem instanceof Error ? problem.message : String(problem)); }
      }}><FolderOpen size={15} />Choose</button>
    </span></label>
    {folder && <div className="settings-buttons"><button type="button" className="text-button" disabled={saving} onClick={() => { setFolder(''); setMessage(''); }}>Remove folder association</button></div>}
    <p className="form-hint">Folder association is optional. Your repository files stay untouched.</p>
    <div className="settings-buttons"><button className="primary-button" disabled={!name.trim() || reading || saving}>{saving ? 'Saving…' : 'Save project settings'}</button></div>
    {error && <p className="field-error" role="alert">{error}</p>}
    {message && <p className="form-hint" role="status">{message}</p>}
    <h2>Delete project</h2>
    <p className="form-hint">Remove this project and its planning data from the workspace. Repository files stay untouched.</p>
    <div className="settings-buttons"><button type="button" className="delete-button" disabled={saving} onClick={onDelete}><Trash2 size={14} />Delete project</button></div>
  </form>;
}
