import { convertTimeToSeconds } from '../../utils/YoutubeUtils';
import { ParsedLine, YtProject } from './types';
import { LANG_OPTIONS } from './constants';

export interface SrtSeg {
  startSec: number;
  endSec: number;
  text: string;
}

export function parseSrt(srt: string): SrtSeg[] {
  const segs: SrtSeg[] = [];
  const blocks = srt.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) continue;
    const [s, e] = lines[ti].split('-->');
    const text = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    segs.push({
      startSec: convertTimeToSeconds(s.trim()),
      endSec: convertTimeToSeconds(e.trim()),
      text,
    });
  }
  return segs;
}

export function buildLines(
  primaryColId: string,
  primarySegs: SrtSeg[],
  others: { colId: string; segs: SrtSeg[] }[]
): ParsedLine[] {
  return primarySegs.map((p, index) => {
    const texts: Record<string, string> = { [primaryColId]: p.text };
    for (const { colId, segs } of others) {
      const over = segs.filter(s => s.startSec < p.endSec && s.endSec > p.startSec);
      texts[colId] = over.map(s => s.text).join(' ').trim();
    }
    return { index, startSec: p.startSec, endSec: p.endSec, texts, translation: '', translated: false };
  });
}

export function extractVideoId(input: string): string | null {
  const clean = input.trim();
  const m =
    clean.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/) ||
    clean.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

export function secondsToHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function colLabel(colId: string, project: YtProject): string {
  if (colId === 'video') return '🎬 Video';
  if (colId === 'translation') {
    const lang = LANG_OPTIONS.find(l => l.code === project.config.targetLang);
    return `🔤 ${lang?.label ?? project.config.targetLang}`;
  }
  if (colId.startsWith('track:')) {
    const lang = colId.replace('track:', '');
    const track = project.tracks.find(t => t.lang === lang);
    return track?.label ?? lang;
  }
  return colId;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
