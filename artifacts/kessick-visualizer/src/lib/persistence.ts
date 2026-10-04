import { StateSnapshot } from '@/store';

const PROJECTS_KEY = 'kessick_projects';
const ACTIVE_PROJECT_KEY = 'kessick_active_project_id';
const LEGACY_PROJECT_OWNER_KEY = 'kessick_legacy_project_owner_v1';
const NEW_PROJECT_SENTINEL = '__new_project__';

export const getSavedProjects = (): StateSnapshot[] => {
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const getClaimableLegacyProjects = (accountId: string): StateSnapshot[] => {
  const projects = getSavedProjects();
  if (projects.length === 0) return [];

  const existingOwner = localStorage.getItem(LEGACY_PROJECT_OWNER_KEY);
  if (existingOwner && existingOwner !== accountId) return [];
  if (!existingOwner) {
    localStorage.setItem(LEGACY_PROJECT_OWNER_KEY, accountId);
  }
  return projects;
};

export const getActiveProjectLocal = (): StateSnapshot | null => {
  try {
    const projects = getSavedProjects();
    const activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (activeProjectId === NEW_PROJECT_SENTINEL) return null;
    if (activeProjectId) {
      const activeProject = projects.find(project => project.project.id === activeProjectId);
      if (activeProject) return activeProject;
    }
    return [...projects].sort((a, b) => b.lastSaved - a.lastSaved)[0] ?? null;
  } catch {
    return null;
  }
};

export const clearActiveProjectLocal = () => {
  localStorage.setItem(ACTIVE_PROJECT_KEY, NEW_PROJECT_SENTINEL);
};

export const saveProjectLocal = (snapshot: StateSnapshot) => {
  try {
    const projects = getSavedProjects();
    const idx = projects.findIndex(p => p.project.id === snapshot.project.id);
    const toSave = { ...snapshot, lastSaved: Date.now() };
    if (idx >= 0) {
      projects[idx] = toSave;
    } else {
      projects.push(toSave);
    }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    localStorage.setItem(ACTIVE_PROJECT_KEY, snapshot.project.id);
  } catch (e) {
    console.error("Failed to save project locally", e);
  }
};

export const deleteProjectLocal = (id: string) => {
  try {
    const projects = getSavedProjects();
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects.filter(p => p.project.id !== id)));
    if (localStorage.getItem(ACTIVE_PROJECT_KEY) === id) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  } catch (e) {
    console.error("Failed to delete project", e);
  }
};

export const exportProjectJSON = (snapshot: StateSnapshot) => {
  const dataStr = JSON.stringify(snapshot, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const name = snapshot.project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'project';
  const a = document.createElement('a');
  a.setAttribute('href', dataUri);
  a.setAttribute('download', `kessick_${name}_${new Date().getTime()}.json`);
  a.click();
};

export const importProjectJSON = (file: File): Promise<StateSnapshot> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.project && json.project.id) {
          resolve(json as StateSnapshot);
        } else {
          reject(new Error("Invalid project JSON"));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};
