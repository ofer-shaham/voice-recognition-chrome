import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { YtProject, YoutubeTheme } from './types';
import { useProject } from './useProject';
import SetupView from './SetupView';
import PlayerView from './PlayerView';
import './YoutubeLearner.css';

interface YoutubeLearnerProps {
  routeBase?: '/youtube' | '/youtube2';
}

export default function YoutubeLearner({ routeBase = '/youtube' }: YoutubeLearnerProps) {
  const { projects, upsert, remove, clearAll, getLastId } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeProject, setActiveProject] = useState<YtProject | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [theme, setTheme] = useState<YoutubeTheme>(() => {
    const saved = localStorage.getItem('youtube-learner-theme');
    return saved === 'dark' || saved === 'blue' ? saved : 'light';
  });

  const handleThemeChange = (next: YoutubeTheme) => {
    setTheme(next);
    localStorage.setItem('youtube-learner-theme', next);
  };

  // Keep the two real views addressable: /youtube/setup and
  // /youtube/project/:projectId. Query links remain supported for sharing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const routeId = location.pathname.startsWith(`${routeBase}/project/`)
      ? decodeURIComponent(location.pathname.slice(`${routeBase}/project/`.length))
      : location.pathname.startsWith(`${routeBase}/view/`)
        ? decodeURIComponent(location.pathname.slice(`${routeBase}/view/`.length))
        : '';
    const urlId = routeId || params.get('v') || params.get('p');
    const fromUrl = urlId ? projects.find(p => p.id === urlId || p.videoId === urlId) : null;

    if (fromUrl) {
      setActiveProject(fromUrl);
      setShowSetup(false);
      if (!location.pathname.startsWith(`${routeBase}/view/`) && location.pathname !== `${routeBase}/project/${encodeURIComponent(fromUrl.id)}`) {
        navigate(`${routeBase}/view/${encodeURIComponent(fromUrl.id)}`, { replace: true });
      }
    } else if (location.pathname === `${routeBase}/setup` || location.pathname === routeBase) {
      setActiveProject(null);
      setShowSetup(true);
    } else {
      setActiveProject(null);
      setShowSetup(true);
    }
  }, [projects, location.pathname, routeBase, navigate]);

  const handleProjectReady = (project: YtProject) => {
    upsert(project);
    setActiveProject(project);
    setShowSetup(false);
    navigate(`${routeBase}/view/${encodeURIComponent(project.id)}`);
  };

  const handleSave = (updated: YtProject) => {
    upsert(updated);
    setActiveProject(updated);
    const route = window.location.pathname.startsWith(`${routeBase}/view/`) ? 'view' : 'project';
    navigate(`${routeBase}/${route}/${encodeURIComponent(updated.id)}`, { replace: true });
  };

  const handleSelectProject = (p: YtProject) => {
    setActiveProject(p);
    setShowSetup(false);
    navigate(`${routeBase}/project/${encodeURIComponent(p.id)}`);
  };

  const handleDelete = (id: string) => {
    remove(id);
    const remaining = projects.filter(p => p.id !== id);
    if (remaining.length > 0) {
      setActiveProject(remaining[0]);
      navigate(`${routeBase}/project/${encodeURIComponent(remaining[0].id)}`);
    } else {
      setActiveProject(null);
      setShowSetup(true);
      navigate(`${routeBase}/setup`);
    }
  };

  if (showSetup || !activeProject) {
    const lastId = getLastId();
    const recent = (lastId ? projects.find(p => p.id === lastId) : projects[0]) ?? null;
    return (
      <SetupView
        onProjectReady={handleProjectReady}
        onProjectFetched={upsert}
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
            navigate(`${routeBase}/setup`);
          }
        }}
        onLoadRecent={() => {
          if (recent) {
            setActiveProject(recent);
            setShowSetup(false);
            navigate(`${routeBase}/project/${encodeURIComponent(recent.id)}`);
          }
        }}
        onClearHistory={() => {
          clearAll();
          setActiveProject(null);
        }}
        theme={theme}
        onThemeChange={handleThemeChange}
      />
    );
  }

  return (
    <PlayerView
      routeBase={routeBase}
      project={activeProject}
      onSave={handleSave}
      onBackHome={() => { setShowSetup(true); setActiveProject(null); navigate(routeBase); }}
      onNewVideo={() => { setShowSetup(true); setActiveProject(null); navigate(`${routeBase}/setup`); }}
      onDelete={handleDelete}
      projects={projects}
      onSelectProject={handleSelectProject}
      theme={theme}
      onThemeChange={handleThemeChange}
    />
  );
}
