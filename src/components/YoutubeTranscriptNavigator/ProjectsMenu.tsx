import { useState, useRef, useEffect } from "react";
import { YtProject } from "../../hooks/useYtProjects";

interface Props {
  projects: YtProject[];
  currentProjectId: string | null;
  onSelectProject: (project: YtProject) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
}

export default function ProjectsMenu({
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = projects.find(p => p.id === currentProjectId) ?? null;

  return (
    <div className="yt-projects-bar">
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
                <div
                  key={p.id}
                  className={`yt-projects-item${p.id === currentProjectId ? " active" : ""}`}
                >
                  <div
                    className="yt-projects-item-info"
                    onClick={() => { onSelectProject(p); setOpen(false); }}
                  >
                    <span className="yt-projects-item-title">{p.title}</span>
                    <span className="yt-projects-item-meta">
                      {p.mode === "auto" ? "📺" : "📋"} {p.tracks.length} track{p.tracks.length !== 1 ? "s" : ""}
                      {" · "}{new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    className="yt-projects-item-del"
                    onClick={e => { e.stopPropagation(); onDeleteProject(p.id); }}
                    title="Delete project"
                  >✕</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {current && (
        <span className="yt-projects-current" title={`Video ID: ${current.videoId}`}>
          {current.title}
          {current.author && <span className="yt-projects-author"> · {current.author}</span>}
        </span>
      )}

      <button className="yt-projects-new" onClick={onNewProject}>
        ＋ New Project
      </button>
    </div>
  );
}
