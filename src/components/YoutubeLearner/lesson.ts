import { chatWithAI, DEFAULT_OPENROUTER_MAX_TOKENS, getStoredOpenRouterMaxTokens } from '../../services/openRouterService';
import { YtProject } from './types';

export interface LessonRow {
  source: string;
  lesson: string;
}

const LESSON_CACHE_KEY = 'yt_openrouter_lessons_v1';
const MASK_CACHE_KEY = 'yt_openrouter_masks_v1';

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

const parseMaskRows = (content: string): string[] => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : content).trim();
  try {
    const parsed = JSON.parse(candidate);
    const values = Array.isArray(parsed) ? parsed : parsed.rows;
    if (Array.isArray(values)) return values.map(value => String(typeof value === 'object' ? value.lesson || value.text || '' : value).trim()).filter(Boolean);
  } catch {
    // Fall through to one generated row per non-empty line.
  }
  return candidate.split(/\r?\n/).map(line => line.replace(/^\s*\d+[.)-]?\s*/, '').trim()).filter(Boolean);
};

const readMaskCache = (): Record<string, string[]> => {
  try { return JSON.parse(localStorage.getItem(MASK_CACHE_KEY) || '{}'); } catch { return {}; }
};

const maskCacheKey = (project: YtProject, difficulty: number, maxRows: number) => `${project.id}:${difficulty}:${maxRows}`;

export const generateDifficultyMask = async (project: YtProject, difficulty: number, maxRows: number, useCache = true, startRow = 0): Promise<string[]> => {
  const safeDifficulty = Math.min(5, Math.max(1, Math.round(difficulty)));
  const safeRows = Math.max(1, Math.round(maxRows));
  const key = `${maskCacheKey(project, safeDifficulty, safeRows)}:${Math.max(0, startRow)}`;
  const cached = useCache ? readMaskCache()[key] : undefined;
  if (cached?.length) return cached;

  const sourceTrack = project.tracks[0];
  if (!sourceTrack?.srtContent) throw new Error('This project has no subtitle file.');
  const subtitleRows = sourceTrack.srtContent.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/).slice(Math.max(0, startRow), Math.max(0, startRow) + safeRows).join('\n\n');
  const prompt = [
    'Create a difficulty mask for language learning from the subtitle rows below.',
    `Difficulty level: ${safeDifficulty}/5.`,
    `Rewrite each subtitle row in the original language using no more than ${safeDifficulty} words per row.`,
    'Keep exactly one output row for every input subtitle row, in the same order.',
    'Keep only the main meaning, remove repetition and unnecessary details, and do not translate to another language.',
    'Return only a JSON array of strings. Do not return timestamps, numbering, explanations, or markdown.',
    '',
    subtitleRows,
  ].join('\n');
  const response = await chatWithAI(
    [{ role: 'user', content: prompt }],
    localStorage.getItem('yt_ai_model') || 'openrouter/auto:free',
    undefined,
    getStoredOpenRouterMaxTokens() || DEFAULT_OPENROUTER_MAX_TOKENS,
  );
  const rows = parseMaskRows(response.content)
    .slice(0, safeRows)
    .map(row => row.split(/\s+/).slice(0, safeDifficulty).join(' '));
  if (!rows.length) throw new Error('OpenRouter returned no difficulty-mask rows.');
  if (useCache) {
    const cache = readMaskCache();
    cache[key] = rows;
    localStorage.setItem(MASK_CACHE_KEY, JSON.stringify(cache));
  }
  return rows;
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

export const generateLesson = async (project: YtProject, lessonNumber: number, maxRows = 30, useCache = true, difficulty = 3): Promise<LessonRow[]> => {
  const cached = useCache ? getCachedLesson(project, lessonNumber) : undefined;
  if (cached?.length) return cached;

  const sourceTrack = project.tracks[0];
  if (!sourceTrack?.srtContent) throw new Error('This project has no subtitle file.');
  const targetLanguage = project.config.targetLang || 'English';
  const safeDifficulty = Math.min(5, Math.max(1, Math.round(difficulty)));
  const subtitleRows = sourceTrack.srtContent.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/).slice(0, Math.max(1, maxRows)).join('\n\n');
  const prompt = [
    `Create lesson ${lessonNumber} from the following video subtitles.`,
    `Target language: ${targetLanguage}.`,
    `Difficulty level: ${safeDifficulty}/5. Adapt the explanations and exercises to this level.`,
    'Return only a JSON array. Each item must have exactly two string fields: source and lesson.',
    'The source field must quote a subtitle line. The lesson field must give a useful translation, explanation, vocabulary note, or grammar exercise in the target language.',
    `Keep the rows in subtitle order and produce up to ${Math.max(1, maxRows)} rows.`,
    '',
    subtitleRows,
  ].join('\n');

  const response = await chatWithAI(
    [{ role: 'user', content: prompt }],
    localStorage.getItem('yt_ai_model') || 'openrouter/auto:free',
    undefined,
    getStoredOpenRouterMaxTokens() || DEFAULT_OPENROUTER_MAX_TOKENS,
  );
  const rows = parseLessonRows(response.content);
  if (!rows.length) throw new Error('OpenRouter returned no lesson rows.');
  if (useCache) saveLesson(project, lessonNumber, rows);
  return rows;
};
