import React, { useState, useEffect } from 'react';
import { YtProject } from './types';
import { useProject } from './useProject';
import SetupView from './SetupView';
import PlayerView from './PlayerView';
import './YoutubeLearner.css';

export default function YoutubeLearner() {
  const { projects, upsert, getLastId } = useProject();
  const [activeProject, setActiveProject] = useState<YtProject | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // On mount: load last used project, or show setup if none exist
  useEffect(() => {
    const lastId = getLastId();
    const last = lastId ? projects.find(p => p.id === lastId) : null;
    if (last) { setActiveProject(last); }
    else if (projects.length > 0) { setActiveProject(projects[0]); }
    else { setShowSetup(true); }
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
      projects={projects}
      onSelectProject={handleSelectProject}
    />
  );
}
