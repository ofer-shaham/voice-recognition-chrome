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

const loadPersistedProjects = (): YtProject[] => {
  try {
    return JSON.parse(localStorage.getItem('yt-learner-projects') || '[]');
  } catch {
    return [];
  }
};

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

  const isSetupRoute = [routeBase, `${routeBase}/setup`, `${routeBase}/home`].includes(location.pathname);
  const isSettingsRoute = location.pathname === `${routeBase}/settings`;
  const isProjectRoute = location.pathname.startsWith(`${routeBase}/view/`) || location.pathname.startsWith(`${routeBase}/project/`);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resolvedProjects = projects.length > 0 ? projects : loadPersistedProjects();
    const routeId = isProjectRoute
      ? decodeURIComponent(location.pathname.slice(`${routeBase}/view/`.length).slice(`${routeBase}/project/`.length))
      : '';
    const urlId = routeId || params.get('v') || params.get('p');
    const fromUrl = urlId ? resolvedProjects.find(p => p.id === urlId || p.videoId === urlId) : null;
    const lastId = getLastId();
    const lastProject = lastId ? resolvedProjects.find(p => p.id === lastId) : resolvedProjects[0] ?? null;

    if (isSettingsRoute) {
      const targetProject = fromUrl ?? lastProject;
      setActiveProject(targetProject);
      setShowSetup(!targetProject);
      return;
    }

    if (isSetupRoute) {
      setActiveProject(null);
      setShowSetup(true);
      return;
    }

    if (fromUrl) {
      setActiveProject(fromUrl);
      setShowSetup(false);
      if (!isProjectRoute) {
        navigate(`${routeBase}/view/${encodeURIComponent(fromUrl.id)}`, { replace: true });
      }
      return;
    }

    if (isProjectRoute) {
      setActiveProject(lastProject);
      setShowSetup(!lastProject);
      return;
    }

    setActiveProject(null);
    setShowSetup(true);
  }, [projects, location.pathname, routeBase, navigate, getLastId, isProjectRoute, isSettingsRoute, isSetupRoute]);

  const handleProjectReady = (project: YtProject) => {
    upsert(project);
    setActiveProject(project);
    setShowSetup(false);
    navigate(`${routeBase}/view/${encodeURIComponent(project.id)}`);
  };

  const handleSave = (updated: YtProject) => {
    upsert(updated);
    setActiveProject(updated);

    const pathname = window.location.pathname;
    if (pathname === `${routeBase}/settings`) {
      navigate(`${routeBase}/settings`, { replace: true });
      return;
    }

    const route = pathname.startsWith(`${routeBase}/view/`) ? 'view' : 'project';
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

  if (location.pathname === `${routeBase}/settings`) {
    const projectToEdit = activeProject ?? (projects[0] ?? null);
    if (!projectToEdit) {
      return (
        <SetupView
          onProjectReady={handleProjectReady}
          onProjectFetched={upsert}
          recentProject={null}
          projects={projects}
          hasHistory={projects.length > 0}
          onLoadProject={handleSelectProject}
          onDeleteProject={() => {}}
          onLoadRecent={() => {}}
          onClearHistory={() => { clearAll(); setActiveProject(null); }}
          theme={theme}
          onThemeChange={handleThemeChange}
        />
      );
    }

    return (
      <PlayerView
        routeBase={routeBase}
        project={projectToEdit}
        onSave={handleSave}
        onBackHome={() => { setShowSetup(true); setActiveProject(null); navigate(`${routeBase}/setup`); }}
        onBackToView={() => {
          setShowSetup(false);
          if (projectToEdit) {
            navigate(`${routeBase}/view/${encodeURIComponent(projectToEdit.id)}`);
          } else {
            navigate(`${routeBase}/setup`);
          }
        }}
        onNewVideo={() => { setShowSetup(true); setActiveProject(null); navigate(`${routeBase}/setup`); }}
        onDelete={handleDelete}
        projects={projects}
        onSelectProject={handleSelectProject}
        theme={theme}
        onThemeChange={handleThemeChange}
        initialShowSettings={true}
        settingsOnly={true}
      />
    );
  }

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
      onBackHome={() => { setShowSetup(true); setActiveProject(null); navigate(`${routeBase}/setup`); }}
      onNewVideo={() => { setShowSetup(true); setActiveProject(null); navigate(`${routeBase}/setup`); }}
      onDelete={handleDelete}
      projects={projects}
      onSelectProject={handleSelectProject}
      theme={theme}
      onThemeChange={handleThemeChange}
      initialShowSettings={false}
    />
  );
}
