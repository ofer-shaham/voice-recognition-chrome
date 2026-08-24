import React, { useState, useEffect } from 'react';
import { YtProject } from './types';
import { useProject } from './useProject';
import SetupView from './SetupView';
import PlayerView from './PlayerView';
import './YoutubeLearner.css';

export default function YoutubeLearner() {
  const { projects, upsert, remove, clearAll, getLastId } = useProject();
  const [activeProject, setActiveProject] = useState<YtProject | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // On mount: show the library by default. Explicit shared links can still
  // open a specific project directly via ?v= or ?p=.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlId  = params.get('v') || params.get('p');
    const fromUrl  = urlId  ? projects.find(p => p.id === urlId  || p.videoId === urlId)  : null;

    if (fromUrl) {
      setActiveProject(fromUrl);
      setShowSetup(false);
    } else {
      setActiveProject(null);
      setShowSetup(true);
    }
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
        projects={projects}
        hasHistory={projects.length > 0}
        onLoadProject={handleSelectProject}
        onDeleteProject={(id) => {
          const project = projects.find(p => p.id === id);
          if (!project || !window.confirm(`Delete "${project.title}"?`)) return;
          remove(id);
          if (recent?.id === id) {
            setActiveProject(null);
            setShowSetup(true);
          }
        }}
        onLoadRecent={() => {
          if (recent) { setActiveProject(recent); setShowSetup(false); }
        }}
        onClearHistory={() => {
          clearAll();
          setActiveProject(null);
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
