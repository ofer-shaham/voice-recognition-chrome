import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { YtProject, YoutubeTheme } from './types';
import { useProject } from './useProject';
import SetupView from './SetupView';
import PlayerView from './PlayerView';
import OpenRouterSettings from './OpenRouterSettings';
import LessonView from './LessonView';
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

const normalizeRoutePath = (path: string) => path.replace(/\/+/g, '/');

export default function YoutubeLearner({ routeBase = '/youtube' }: YoutubeLearnerProps) {
  const { projects, upsert, remove, clearAll, getLastId } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const path = normalizeRoutePath(location.pathname);
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

  const isSetupRoute = [routeBase, `${routeBase}/setup`, `${routeBase}/home`].includes(path);
  const isSettingsHomeRoute = path === `${routeBase}/settings`;
  const isTranslationSettingsRoute = path === `${routeBase}/settings/translation`;
  const isOpenRouterSettingsRoute = path === `${routeBase}/settings/openrouter`;
  const isSettingsRoute = isSettingsHomeRoute || isTranslationSettingsRoute || isOpenRouterSettingsRoute;
  const lessonMatch = path.match(new RegExp(`^${routeBase}/view/lesson/([1-5])$`));
  const isLessonRoute = !!lessonMatch;
  const isProjectRoute = path.startsWith(`${routeBase}/view/`) || path.startsWith(`${routeBase}/project/`);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resolvedProjects = projects.length > 0 ? projects : loadPersistedProjects();
    const routeId = (() => {
      if (path.startsWith(`${routeBase}/view/`) && !isLessonRoute) {
        return decodeURIComponent(path.slice(`${routeBase}/view/`.length));
      }
      if (path.startsWith(`${routeBase}/project/`)) {
        return decodeURIComponent(path.slice(`${routeBase}/project/`.length));
      }
      return '';
    })();
    const sharedVideoId = params.get('v');
    const fromSharedVideo = sharedVideoId
      ? resolvedProjects.find(p => p.videoId === sharedVideoId)
      : null;
    const fromRoute = routeId
      ? resolvedProjects.find(p => p.id === routeId || p.videoId === routeId)
      : null;
    const projectId = params.get('p');
    const fromProjectParam = projectId
      ? resolvedProjects.find(p => p.id === projectId)
      : null;
    const fromUrl = fromSharedVideo ?? fromRoute ?? fromProjectParam;
    const lastId = getLastId();
    const lastProject = lastId ? resolvedProjects.find(p => p.id === lastId) : resolvedProjects[0] ?? null;

    if (isSettingsRoute) {
      const targetProject = fromUrl ?? lastProject;
      setActiveProject(targetProject ?? null);
      setShowSetup(!targetProject);
      return;
    }

    if (isLessonRoute) {
      setActiveProject(fromUrl ?? lastProject);
      setShowSetup(!fromUrl && !lastProject);
      return;
    }

    if (isSetupRoute) {
      setActiveProject(null);
      setShowSetup(true);
      return;
    }

    if (fromUrl) {
      setActiveProject(fromUrl ?? null);
      setShowSetup(false);
      if (!isProjectRoute) {
        navigate(`${routeBase}/view/${encodeURIComponent(fromUrl.id)}`, { replace: true });
      }
      return;
    }

    if (isProjectRoute) {
      setActiveProject(lastProject ?? null);
      setShowSetup(!lastProject);
      return;
    }

    setActiveProject(null);
    setShowSetup(true);
  }, [projects, path, routeBase, navigate, getLastId, isProjectRoute, isSettingsRoute, isSetupRoute, isLessonRoute]);

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
    if (pathname === `${routeBase}/settings` || pathname === `${routeBase}/settings/translation`) {
      navigate(`${routeBase}/settings/translation`, { replace: true });
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

  if (isSettingsHomeRoute) {
    return (
      <div className={`yl-player yl-theme-${theme}`}>
        <div className="yl-header">
          <div className="yl-header-left">
            <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/setup`)}>Home</button>
            {activeProject && <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/view/${encodeURIComponent(activeProject.id)}`)}>View</button>}
            <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/setup`)}>New</button>
            <label className="yl-theme-control">
              <span className="yl-sr-only">Theme</span>
              <select className="yl-theme-select" value={theme} onChange={e => handleThemeChange(e.target.value as YoutubeTheme)}>
                <option value="light">Light</option>
                <option value="blue">Blue</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </div>
        </div>
        <div className="yl-settings">
          <div className="yl-settings-heading">
            <div>
              <strong>YouTube settings</strong>
              <span>Choose a settings category.</span>
            </div>
          </div>
          <div className="yl-settings-tabs" role="tablist" aria-label="YouTube settings">
            <button className="yl-settings-tab" role="tab" onClick={() => navigate(`${routeBase}/settings/translation`)}>
              Translation
            </button>
            <button className="yl-settings-tab" role="tab" onClick={() => navigate(`${routeBase}/settings/openrouter`)}>
              OpenRouter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isOpenRouterSettingsRoute) {
    return <OpenRouterSettings routeBase={routeBase} theme={theme} onThemeChange={handleThemeChange} project={activeProject ?? projects[0] ?? null} />;
  }

  if (isLessonRoute && activeProject && lessonMatch) {
    return <LessonView project={activeProject} lessonNumber={Number(lessonMatch[1])} routeBase={routeBase} theme={theme} onThemeChange={handleThemeChange} />;
  }

  if (isTranslationSettingsRoute) {
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
          onDeleteProject={() => { }}
          onLoadRecent={() => { }}
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
