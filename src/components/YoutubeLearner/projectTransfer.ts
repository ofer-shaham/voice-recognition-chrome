import { YtProject } from './types';

export function downloadProject(project: YtProject): void {
  const safeName = (project.title || project.videoId || 'youtube-project')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'youtube-project';
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseProjectFile(text: string): YtProject {
  const value = JSON.parse(text) as Partial<YtProject>;
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' ||
      typeof value.videoId !== 'string' || !Array.isArray(value.tracks) || !value.config) {
    throw new Error('This file is not a valid YouTube learner project.');
  }
  return {
    ...value,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastLine: typeof value.lastLine === 'number' ? value.lastLine : 0,
  } as YtProject;
}