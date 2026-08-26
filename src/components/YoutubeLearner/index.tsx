import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { YtProject, YoutubeTheme } from './types';
import { useProject } from './useProject';
import SetupView from './SetupView';
import PlayerView from './PlayerView';
import './YoutubeLearner.css';

export default function YoutubeLearner() {
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
    const routeId = location.pathname.startsWith('/youtube/project/')
      ? decodeURIComponent(location.pathname.slice('/youtube/project/'.length))
      : '';
    const urlId = routeId || params.get('v') || params.get('p');
    const fromUrl = urlId ? projects.find(p => p.id === urlId || p.videoId === urlId) : null;

    if (fromUrl) {
      setActiveProject(fromUrl);
      setShowSetup(false);
      if (location.pathname !== `/youtube/project/${encodeURIComponent(fromUrl.id)}`) {
        navigate(`/youtube/project/${encodeURIComponent(fromUrl.id)}`, { replace: true });
      }
    } else if (location.pathname === '/youtube/setup' || location.pathname === '/youtube') {
      setActiveProject(null);
      setShowSetup(true);
    } else {
      setActiveProject(null);
      setShowSetup(true);
    }
  }, [projects, location.pathname]);

  const handleProjectReady = (project: YtProject) => {
    upsert(project);
    setActiveProject(project);
    setShowSetup(false);
    navigate(`/youtube/project/${encodeURIComponent(project.id)}`);
  };

  const handleSave = (updated: YtProject) => {
    upsert(updated);
    setActiveProject(updated);
    navigate(`/youtube/project/${encodeURIComponent(updated.id)}`, { replace: true });
  };

  const handleSelectProject = (p: YtProject) => {
    setActiveProject(p);
    setShowSetup(false);
    navigate(`/youtube/project/${encodeURIComponent(p.id)}`);
  };

  const handleDelete = (id: string) => {
    remove(id);
    const remaining = projects.filter(p => p.id !== id);
    if (remaining.length > 0) {
      setActiveProject(remaining[0]);
      navigate(`/youtube/project/${encodeURIComponent(remaining[0].id)}`);
    } else {
      setActiveProject(null);
      setShowSetup(true);
      navigate('/youtube/setup');
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
             navigate('/youtube/setup');
          }
        }}
        onLoadRecent={() => {
           if (recent) {
             setActiveProject(recent);
             setShowSetup(false);
             navigate(`/youtube/project/${encodeURIComponent(recent.id)}`);
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
      project={activeProject}
      onSave={handleSave}
      onBackHome={() => { setShowSetup(true); setActiveProject(null); navigate('/youtube'); }}
       onNewVideo={() => { setShowSetup(true); setActiveProject(null); navigate('/youtube/setup'); }}
      onDelete={handleDelete}
      projects={projects}
      onSelectProject={handleSelectProject}
      theme={theme}
      onThemeChange={handleThemeChange}
    />
  );
}
