import { useState, useRef, useEffect, useCallback } from "react";
import { YtProject } from "../../hooks/useYtProjects";

interface Props {
  projects: YtProject[];
  currentProjectId: string | null;
  onSelectProject: (project: YtProject) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  onVideoUrlSubmit: (url: string) => void;
  videoLookupLoading: boolean;
  videoLookupTitle: string | null;
  videoLookupError: string;
  toLang: string;
  onToLangChange: (v: string) => void;
}

function extractVideoId(input: string): string {
  const clean = input.trim();
  const m =
    clean.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/) ||
    clean.match(/^([\w-]{11})$/);
  return m ? m[1] : clean;
}

export default function ProjectsMenu({
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onVideoUrlSubmit,
  videoLookupLoading,
  videoLookupTitle,
  videoLookupError,
  toLang,
  onToLangChange,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onVideoUrlSubmit(trimmed);
  }, [urlInput, onVideoUrlSubmit]);

  const current    = projects.find(p => p.id === currentProjectId) ?? null;
  const hasInput   = urlInput.trim().length > 0;

  return (
    <div className="yt-projects-bar">

      {/* ── Projects dropdown ── */}
      <div className="yt-projects-left" ref={menuRef}>
        <button
          className={`yt-projects-toggle${open ? " open" : ""}`}
          onClick={() => setOpen(v => !v)}
          title="Open projects list"
        >
          📁 Projects
          {projects.length > 0 && <span className="yt-projects-count">{projects.length}</span>}
          <span className="yt-projects-caret">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="yt-projects-dropdown">
            {projects.length === 0 ? (
              <div className="yt-projects-empty">No saved projects yet.</div>
            ) : (
              projects.map(p => (
                <div key={p.id} className={`yt-projects-item${p.id === currentProjectId ? " active" : ""}`}>
                  <div className="yt-projects-item-info" onClick={() => { onSelectProject(p); setOpen(false); }}>
                    <span className="yt-projects-item-title">{p.title}</span>
                    <span className="yt-projects-item-meta">
                      {p.mode === "auto" ? "📺" : "📋"} {p.tracks.length} track{p.tracks.length !== 1 ? "s" : ""}
                      {" · "}{new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button className="yt-projects-item-del"
                    onClick={e => { e.stopPropagation(); onDeleteProject(p.id); }}
                    title="Delete project">✕</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── YouTube URL lookup ── */}
      <div className="yt-menu-url-wrap">
        <div className="yt-menu-url-row">
          <input
            className="yt-menu-url-input"
            type="text"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="YouTube URL or video ID…"
          />
          <button className="yt-menu-url-btn" onClick={handleSubmit}
            disabled={!hasInput || videoLookupLoading} title="Look up video">
            {videoLookupLoading ? "…" : "▶"}
          </button>
        </div>
        {videoLookupLoading && (
          <div className="yt-menu-url-status loading">Looking up video…</div>
        )}
        {!videoLookupLoading && videoLookupTitle && (
          <div className="yt-menu-url-status ok">📺 {videoLookupTitle}</div>
        )}
        {!videoLookupLoading && videoLookupError && (
          <div className="yt-menu-url-status err">⚠ {videoLookupError}</div>
        )}
      </div>

      {/* ── Translate-to language ── */}
      <div className="yt-menu-lang-wrap">
        <label className="yt-menu-lang-label">Translate to</label>
        <input
          className="yt-menu-lang-input"
          type="text"
          value={toLang}
          onChange={e => onToLangChange(e.target.value)}
          placeholder="en, he, ar…"
          title="Target language code for translation (e.g. en, he, ar, ru)"
        />
      </div>

      {/* ── Current project name (when no lookup active) ── */}
      {current && !videoLookupTitle && (
        <span className="yt-projects-current" title={`Video ID: ${current.videoId}`}>
          {current.title}
          {current.author && <span className="yt-projects-author"> · {current.author}</span>}
        </span>
      )}

      {/* ── New Project button ── */}
      <button
        className={`yt-projects-new${videoLookupTitle ? " ready" : ""}`}
        onClick={onNewProject}
        title={videoLookupTitle ? `Create project for "${videoLookupTitle}"` : "Create new project"}
      >
        {videoLookupTitle ? "＋ Create Project" : "＋ New Project"}
      </button>
    </div>
  );
}
