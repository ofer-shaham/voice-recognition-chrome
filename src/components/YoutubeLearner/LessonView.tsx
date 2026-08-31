import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { YtProject, YoutubeTheme } from './types';
import { generateLesson, getCachedLesson, LessonRow } from './lesson';

interface Props {
  project: YtProject;
  lessonNumber: number;
  routeBase: '/youtube' | '/youtube2';
  theme: YoutubeTheme;
  onThemeChange: (theme: YoutubeTheme) => void;
}

export default function LessonView({ project, lessonNumber, routeBase, theme, onThemeChange }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LessonRow[]>(() => getCachedLesson(project, lessonNumber) || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLesson = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await generateLesson(project, lessonNumber));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rows.length) void loadLesson();
    // Lesson identity changes with the route; cached rows initialize this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, lessonNumber]);

  return (
    <div className={`yl-player yl-theme-${theme}`}>
      <div className="yl-header">
        <div className="yl-header-left">
          <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/view/${encodeURIComponent(project.id)}`)}>View</button>
          <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/settings/openrouter`)}>OpenRouter</button>
          <label className="yl-theme-control">
            <span className="yl-sr-only">Theme</span>
            <select className="yl-theme-select" value={theme} onChange={e => onThemeChange(e.target.value as YoutubeTheme)}>
              <option value="light">Light</option>
              <option value="blue">Blue</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <span className="yl-video-title" title={project.title}>{project.title}</span>
        </div>
        <div className="yl-header-right">
          {[1, 2, 3, 4, 5].map(number => (
            <button key={number} className={`yl-btn-ghost ${number === lessonNumber ? 'yl-active' : ''}`} onClick={() => navigate(`${routeBase}/view/lesson/${number}`)}>
              Lesson {number}
            </button>
          ))}
        </div>
      </div>
      <div className="yl-settings" style={{ overflow: 'auto', maxHeight: 'none', flex: 1 }}>
        <div className="yl-settings-heading">
          <div>
            <strong>Lesson {lessonNumber}</strong>
            <span>Cached OpenRouter lesson for this subtitle file.</span>
          </div>
          <button className="yl-btn-secondary" onClick={loadLesson} disabled={loading}>Regenerate</button>
        </div>
        {loading && <p className="yl-setting-info">Generating lesson…</p>}
        {error && <p className="yl-error">{error}</p>}
        {!loading && !error && rows.length > 0 && (
          <table className="yl-table">
            <thead><tr><th className="yl-th-text">Subtitle</th><th className="yl-th-text">Lesson</th></tr></thead>
            <tbody>{rows.map((row, index) => <tr key={`${index}-${row.source}`}><td className="yl-td-text">{row.source}</td><td className="yl-td-text">{row.lesson}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
