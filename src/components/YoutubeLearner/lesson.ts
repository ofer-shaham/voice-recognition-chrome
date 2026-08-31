import { chatWithAI } from '../../services/openRouterService';
import { YtProject } from './types';

export interface LessonRow {
  source: string;
  lesson: string;
}

const LESSON_CACHE_KEY = 'yt_openrouter_lessons_v1';

type LessonCache = Record<string, LessonRow[]>;

const readCache = (): LessonCache => {
  try {
    return JSON.parse(localStorage.getItem(LESSON_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const cacheKey = (project: YtProject, lessonNumber: number) => `${project.id}:${lessonNumber}`;

export const getCachedLesson = (project: YtProject, lessonNumber: number): LessonRow[] | undefined => {
  const value = readCache()[cacheKey(project, lessonNumber)];
  return Array.isArray(value) ? value : undefined;
};

const saveLesson = (project: YtProject, lessonNumber: number, rows: LessonRow[]) => {
  const cache = readCache();
  cache[cacheKey(project, lessonNumber)] = rows;
  localStorage.setItem(LESSON_CACHE_KEY, JSON.stringify(cache));
};

const parseLessonRows = (content: string): LessonRow[] => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : content).trim();
  try {
    const parsed = JSON.parse(candidate);
    const rows = Array.isArray(parsed) ? parsed : parsed.rows;
    if (Array.isArray(rows)) {
      return rows
        .map(row => ({ source: String(row.source || '').trim(), lesson: String(row.lesson || '').trim() }))
        .filter(row => row.source && row.lesson);
    }
  } catch {
    // Fall through to a simple line format for model variation.
  }

  return candidate.split(/\r?\n/)
    .map(line => line.split(/\s*\|\s*/))
    .filter(parts => parts.length >= 2)
    .map(parts => ({ source: parts[0].trim(), lesson: parts.slice(1).join(' | ').trim() }))
    .filter(row => row.source && row.lesson);
};

export const generateLesson = async (project: YtProject, lessonNumber: number): Promise<LessonRow[]> => {
  const cached = getCachedLesson(project, lessonNumber);
  if (cached?.length) return cached;

  const sourceTrack = project.tracks[0];
  if (!sourceTrack?.srtContent) throw new Error('This project has no subtitle file.');
  const targetLanguage = project.config.targetLang || 'English';
  const prompt = [
    `Create lesson ${lessonNumber} from the following video subtitles.`,
    `Target language: ${targetLanguage}.`,
    'Return only a JSON array. Each item must have exactly two string fields: source and lesson.',
    'The source field must quote a subtitle line. The lesson field must give a useful translation, explanation, vocabulary note, or grammar exercise in the target language.',
    'Keep the rows in subtitle order and produce up to 30 rows.',
    '',
    sourceTrack.srtContent,
  ].join('\n');

  const response = await chatWithAI([{ role: 'user', content: prompt }], localStorage.getItem('yt_ai_model') || 'openrouter/auto:free');
  const rows = parseLessonRows(response.content);
  if (!rows.length) throw new Error('OpenRouter returned no lesson rows.');
  saveLesson(project, lessonNumber, rows);
  return rows;
};
