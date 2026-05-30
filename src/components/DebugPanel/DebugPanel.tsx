import React, { useEffect, useRef, useState, useCallback } from 'react';
import './DebugPanel.css';

interface LogEntry {
  id: number;
  ts: string;
  kind: 'fetch-ok' | 'fetch-err' | 'js-error' | 'unhandled' | 'console-error' | 'console-warn';
  label: string;
  detail: string;
}

let globalEntries: LogEntry[] = [];
let listeners: Array<(entries: LogEntry[]) => void> = [];
let interceptInstalled = false;
let idSeq = 0;

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function push(entry: Omit<LogEntry, 'id' | 'ts'>) {
  const full: LogEntry = { id: ++idSeq, ts: now(), ...entry };
  globalEntries = [full, ...globalEntries].slice(0, 200);
  listeners.forEach(fn => fn([...globalEntries]));
}

function installInterceptors() {
  if (interceptInstalled) return;
  interceptInstalled = true;

  // ── Fetch interceptor ─────────────────────────────────────────────────────
  const origFetch = window.fetch.bind(window);
  (window as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const shortUrl = url.replace(window.location.origin, '');
    const t0 = Date.now();
    try {
      const res = await origFetch(input, init);
      const elapsed = Date.now() - t0;
      const ok = res.ok;
      const kind = ok ? 'fetch-ok' : 'fetch-err';
      const cloned = res.clone();
      let body = '';
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const j = await cloned.json();
          body = JSON.stringify(j).slice(0, 300);
        } else {
          body = (await cloned.text()).slice(0, 300);
        }
      } catch { body = '(could not read body)'; }
      push({
        kind,
        label: `${method} ${shortUrl}  →  ${res.status} ${res.statusText}  (${elapsed}ms)`,
        detail: body,
      });
      return res;
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      push({
        kind: 'fetch-err',
        label: `${method} ${shortUrl}  →  NETWORK ERROR  (${elapsed}ms)`,
        detail: err?.message || String(err),
      });
      throw err;
    }
  };

  // ── console.error / console.warn ──────────────────────────────────────────
  const origError = console.error.bind(console);
  const origWarn  = console.warn.bind(console);
  console.error = (...args: any[]) => {
    push({ kind: 'console-error', label: 'console.error', detail: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').slice(0, 400) });
    origError(...args);
  };
  console.warn = (...args: any[]) => {
    push({ kind: 'console-warn', label: 'console.warn', detail: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').slice(0, 400) });
    origWarn(...args);
  };

  // ── window errors + unhandled promise rejections ──────────────────────────
  window.addEventListener('error', (e) => {
    push({ kind: 'js-error', label: `JS Error: ${e.message}`, detail: `${e.filename}:${e.lineno}:${e.colno}` });
  });
  window.addEventListener('unhandledrejection', (e) => {
    push({ kind: 'unhandled', label: 'Unhandled Promise Rejection', detail: String(e.reason?.message || e.reason || '') });
  });
}

function useLogEntries() {
  const [entries, setEntries] = useState<LogEntry[]>([...globalEntries]);
  useEffect(() => {
    listeners.push(setEntries);
    setEntries([...globalEntries]);
    return () => { listeners = listeners.filter(fn => fn !== setEntries); };
  }, []);
  return entries;
}

const ICONS: Record<LogEntry['kind'], string> = {
  'fetch-ok':      '✅',
  'fetch-err':     '❌',
  'js-error':      '💥',
  'unhandled':     '⚠️',
  'console-error': '🔴',
  'console-warn':  '🟡',
};

export default function DebugPanel() {
  const [open, setOpen]         = useState(false);
  const [copied, setCopied]     = useState(false);
  const [filter, setFilter]     = useState<'all' | 'errors'>('all');
  const entries                 = useLogEntries();
  const panelRef                = useRef<HTMLDivElement>(null);

  useEffect(() => { installInterceptors(); }, []);

  const errorCount = entries.filter(e => e.kind === 'fetch-err' || e.kind === 'js-error' || e.kind === 'unhandled' || e.kind === 'console-error').length;

  const visible = filter === 'errors'
    ? entries.filter(e => e.kind === 'fetch-err' || e.kind === 'js-error' || e.kind === 'unhandled' || e.kind === 'console-error')
    : entries;

  const buildText = useCallback(() => {
    const lines: string[] = [
      `=== Debug Log — ${now()} ===`,
      `URL: ${window.location.href}`,
      `UA:  ${navigator.userAgent}`,
      '',
      ...entries.map(e => `[${e.ts}] ${ICONS[e.kind]} ${e.label}\n    ${e.detail}`),
    ];
    return lines.join('\n');
  }, [entries]);

  const copyAll = () => {
    const text = buildText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const clearAll = () => {
    globalEntries = [];
    listeners.forEach(fn => fn([]));
  };

  return (
    <div className="dbg-root" ref={panelRef}>
      {/* Floating toggle button */}
      <button
        className={`dbg-fab ${errorCount > 0 ? 'dbg-fab-errors' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Debug logs"
      >
        🐛{errorCount > 0 && <span className="dbg-badge">{errorCount}</span>}
      </button>

      {open && (
        <div className="dbg-panel">
          <div className="dbg-panel-header">
            <span className="dbg-panel-title">Debug Logs</span>
            <div className="dbg-panel-actions">
              <button
                className={`dbg-filter-btn ${filter === 'all' ? 'dbg-filter-active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({entries.length})
              </button>
              <button
                className={`dbg-filter-btn ${filter === 'errors' ? 'dbg-filter-active' : ''}`}
                onClick={() => setFilter('errors')}
              >
                Errors ({errorCount})
              </button>
              <button className="dbg-action-btn dbg-copy-btn" onClick={copyAll} title="Copy all logs to clipboard">
                {copied ? '✔ Copied!' : '📋 Copy All'}
              </button>
              <button className="dbg-action-btn" onClick={clearAll} title="Clear logs">🗑</button>
              <button className="dbg-action-btn dbg-close-btn" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="dbg-empty">
              {filter === 'errors' ? 'No errors recorded 🎉' : 'No logs yet — try loading a video.'}
            </div>
          ) : (
            <div className="dbg-entries">
              {visible.map(e => (
                <div key={e.id} className={`dbg-entry dbg-entry-${e.kind}`}>
                  <div className="dbg-entry-header">
                    <span className="dbg-entry-icon">{ICONS[e.kind]}</span>
                    <span className="dbg-entry-label">{e.label}</span>
                    <span className="dbg-entry-ts">{e.ts.slice(11)}</span>
                  </div>
                  {e.detail && (
                    <div className="dbg-entry-detail">{e.detail}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="dbg-panel-footer">
            <span className="dbg-footer-hint">
              Paste log with <strong>📋 Copy All</strong> and send to developer
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
