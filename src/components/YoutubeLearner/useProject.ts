import { useState, useCallback } from 'react';
import { YtProject, ProjectConfig } from './types';

const KEY = 'yt-learner-projects';
const LAST_KEY = 'yt-learner-last';

const load = (): YtProject[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
};

export function useProject() {
  const [projects, setProjects] = useState<YtProject[]>(load);

  const upsert = useCallback((p: YtProject) => {
    setProjects(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      const next = idx >= 0
        ? prev.map((x, i) => i === idx ? { ...p, updatedAt: Date.now() } : x)
        : [{ ...p, updatedAt: Date.now() }, ...prev];
      localStorage.setItem(KEY, JSON.stringify(next));
      localStorage.setItem(LAST_KEY, p.id);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateConfig = useCallback((id: string, patch: Partial<ProjectConfig>) => {
    setProjects(prev => {
      const next = prev.map(p =>
        p.id === id ? { ...p, config: { ...p.config, ...patch }, updatedAt: Date.now() } : p
      );
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateLastLine = useCallback((id: string, lastLine: number) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, lastLine } : p);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getLastId = useCallback(() => localStorage.getItem(LAST_KEY), []);

  return { projects, upsert, remove, updateConfig, updateLastLine, getLastId };
}
