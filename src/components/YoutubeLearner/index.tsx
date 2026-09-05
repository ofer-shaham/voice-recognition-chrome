import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { YtProject, YoutubeTheme } from './types';
import { useProject } from './useProject';
import SetupView from './SetupView';
import PlayerView from './PlayerView';
import OpenRouterSettings from './OpenRouterSettings';
import LessonView from './LessonView';
import { OPENROUTER_API_KEY_STORAGE } from '../../services/openRouterService';
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

const SHARED_URL_HISTORY_KEY = 'yt-shared-url-history';
const loadSharedUrlHistory = (): Array<{ url: string; timestamp: string }> => {
  try {
    const value = JSON.parse(localStorage.getItem(SHARED_URL_HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.filter(item => item?.url && item?.timestamp).slice(0, 100) : [];
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
  const isHistoryRoute = path === `${routeBase}/history`;
  const isTranslationSettingsRoute = path === `${routeBase}/settings/translation`;
  const isOpenRouterSettingsRoute = path === `${routeBase}/settings/openrouter`;
  const isSettingsRoute = isSettingsHomeRoute || isTranslationSettingsRoute || isOpenRouterSettingsRoute;
  const lessonMatch = path.match(new RegExp(`^${routeBase}/view/lesson/([1-5])$`));
  const isLessonRoute = !!lessonMatch;
  const isProjectRoute = path.startsWith(`${routeBase}/view/`) || path.startsWith(`${routeBase}/project/`);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!isHistoryRoute && params.toString()) {
      const history = loadSharedUrlHistory();
      const currentUrl = window.location.href;
      if (!history.some(item => item.url === currentUrl)) {
        localStorage.setItem(SHARED_URL_HISTORY_KEY, JSON.stringify([
          { url: currentUrl, timestamp: new Date().toISOString() },
          ...history,
        ].slice(0, 100)));
      }
    }
    const sharedApiKey = params.get('orKey');
    if (sharedApiKey) localStorage.setItem(OPENROUTER_API_KEY_STORAGE, sharedApiKey);
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
    const sharedSourceUrl = params.get('url');
    const fromUrl = sharedSourceUrl ? null : fromSharedVideo ?? fromRoute ?? fromProjectParam;
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
      setActiveProject(null);
      setShowSetup(true);
      return;
    }

    setActiveProject(null);
    setShowSetup(true);
  }, [projects, path, routeBase, navigate, getLastId, isProjectRoute, isSettingsRoute, isSetupRoute, isLessonRoute, isHistoryRoute]);

  const handleProjectReady = (project: YtProject) => {
    upsert(project);
    setActiveProject(project);
    setShowSetup(false);
    navigate(`${routeBase}/view/${encodeURIComponent(project.id)}${window.location.search}`);
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

  if (isHistoryRoute) {
    const history = loadSharedUrlHistory();
    return (
      <div className={`yl-player yl-theme-${theme}`}>
        <div className="yl-header">
          <div className="yl-header-left">
            <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/setup`)}>Home</button>
            <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/history`)}>History</button>
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
        <div className="yl-settings yl-history-page">
          <div className="yl-settings-heading">
            <div>
              <strong>Shared URL history</strong>
              <span>Reopen a previous link to retrigger its project and subtitle handling.</span>
            </div>
            <button className="yl-btn-ghost yl-btn-sm" onClick={() => { localStorage.removeItem(SHARED_URL_HISTORY_KEY); navigate(`${routeBase}/history`, { replace: true }); }}>Clear</button>
          </div>
          {!history.length ? <p className="yl-setting-info">No shared URLs recorded yet.</p> : (
            <div className="yl-history-list">
              {history.map(item => {
                const parsed = new URL(item.url);
                const videoId = parsed.searchParams.get('v') || parsed.searchParams.get('p') || 'shared link';
                return (
                  <div className="yl-history-item" key={`${item.timestamp}-${item.url}`}>
                    <div className="yl-history-item-main">
                      <strong>{videoId}</strong>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                      <code>{item.url}</code>
                    </div>
                    <div className="yl-history-item-actions">
                      <button className="yl-btn-secondary yl-btn-sm" onClick={() => { window.location.href = item.url; }}>Open</button>
                      <button className="yl-btn-ghost yl-btn-sm" onClick={async () => {
                        try {
                          if (navigator.share) await navigator.share({ title: `YouTube ${videoId}`, url: item.url });
                          else await navigator.clipboard.writeText(item.url);
                        } catch { window.prompt('Copy this URL:', item.url); }
                      }}>Share</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

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
