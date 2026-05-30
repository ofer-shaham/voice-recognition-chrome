import React, { useState, useEffect } from 'react';
import { YtProject } from './types';
import { useProject } from './useProject';
import SetupView from './SetupView';
import PlayerView from './PlayerView';
import './YoutubeLearner.css';

export default function YoutubeLearner() {
  const { projects, upsert, remove, getLastId } = useProject();
  const [activeProject, setActiveProject] = useState<YtProject | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // On mount: prefer project from URL ?v= or ?p=, then last used, then first available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlId  = params.get('v') || params.get('p');
    const lastId = getLastId();

    const fromUrl  = urlId  ? projects.find(p => p.id === urlId  || p.videoId === urlId)  : null;
    const fromLast = lastId ? projects.find(p => p.id === lastId) : null;
    const target   = fromUrl || fromLast || (projects.length > 0 ? projects[0] : null);

    if (target) { setActiveProject(target); }
    else        { setShowSetup(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProjectReady = (project: YtProject) => {
    upsert(project);
    setActiveProject(project);
    setShowSetup(false);
  };

  const handleSave = (updated: YtProject) => {
    upsert(updated);
    setActiveProject(updated);
  };

  const handleSelectProject = (p: YtProject) => {
    setActiveProject(p);
    setShowSetup(false);
  };

  const handleDelete = (id: string) => {
    remove(id);
    const remaining = projects.filter(p => p.id !== id);
    if (remaining.length > 0) {
      setActiveProject(remaining[0]);
    } else {
      setActiveProject(null);
      setShowSetup(true);
    }
  };

  if (showSetup || !activeProject) {
    const lastId = getLastId();
    const recent = (lastId ? projects.find(p => p.id === lastId) : projects[0]) ?? null;
    return (
      <SetupView
        onProjectReady={handleProjectReady}
        recentProject={recent}
        onLoadRecent={() => {
          if (recent) { setActiveProject(recent); setShowSetup(false); }
        }}
      />
    );
  }

  return (
    <PlayerView
      project={activeProject}
      onSave={handleSave}
      onNewVideo={() => setShowSetup(true)}
      onDelete={handleDelete}
      projects={projects}
      onSelectProject={handleSelectProject}
    />
  );
}
