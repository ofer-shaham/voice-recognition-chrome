import React, { useEffect, useRef, useState, useCallback } from 'react';
import './DebugPanel.css';

interface LogEntry {
  id: number;
  ts: string;
  kind: 'fetch-ok' | 'fetch-err' | 'js-error' | 'unhandled' | 'console-error' | 'console-warn';
  label: string;
  detail: string;
}

interface ServerLogEntry {
  id: number;
  ts: string;
  level: string;
  msg: string;
  meta: Record<string, unknown>;
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

  const origFetch = window.fetch.bind(window);
  (window as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const shortUrl = url.replace(window.location.origin, '');
    if (shortUrl.startsWith('/api/logs')) return origFetch(input, init);
    const t0 = Date.now();
    try {
      const res = await origFetch(input, init);
      const elapsed = Date.now() - t0;
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
        kind: res.ok ? 'fetch-ok' : 'fetch-err',
        label: `${method} ${shortUrl}  →  ${res.status} ${res.statusText}  (${elapsed}ms)`,
        detail: body,
      });
      return res;
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      push({ kind: 'fetch-err', label: `${method} ${shortUrl}  →  NETWORK ERROR  (${elapsed}ms)`, detail: err?.message || String(err) });
      throw err;
    }
  };

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

function useServerLogs(enabled: boolean) {
  const [entries, setEntries] = useState<ServerLogEntry[]>([]);
  const maxIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await window.fetch(`/api/logs?since=${maxIdRef.current}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.entries?.length) {
          setEntries(prev => [...data.entries, ...prev].slice(0, 200));
          maxIdRef.current = data.maxId;
        }
      } catch { /* server may not be up */ }
      if (!cancelled) timer = setTimeout(poll, 2500);
    };

    let timer = setTimeout(poll, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [enabled]);

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

const SERVER_LEVEL_ICON: Record<string, string> = {
  INFO: '🔵', ERROR: '🔴', WARN: '🟡', DEBUG: '⚪',
};

type Tab = 'client' | 'server';

export default function DebugPanel() {
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState<Tab>('client');
  const [copied, setCopied]   = useState(false);
  const [filter, setFilter]   = useState<'all' | 'errors'>('all');
  const entries               = useLogEntries();
  const serverEntries         = useServerLogs(open && tab === 'server');
  const panelRef              = useRef<HTMLDivElement>(null);

  useEffect(() => { installInterceptors(); }, []);

  const errorCount = entries.filter(e =>
    e.kind === 'fetch-err' || e.kind === 'js-error' || e.kind === 'unhandled' || e.kind === 'console-error'
  ).length;

  const serverErrorCount = serverEntries.filter(e => e.level === 'ERROR').length;

  const visible = filter === 'errors'
    ? entries.filter(e => e.kind === 'fetch-err' || e.kind === 'js-error' || e.kind === 'unhandled' || e.kind === 'console-error')
    : entries;

  const visibleServer = filter === 'errors'
    ? serverEntries.filter(e => e.level === 'ERROR' || e.level === 'WARN')
    : serverEntries;

  const buildText = useCallback(() => {
    const clientLines = entries.map(e => `[${e.ts}] ${ICONS[e.kind]} ${e.label}\n    ${e.detail}`);
    const serverLines = serverEntries.map(e => `[${e.ts}] [${e.level}] ${e.msg} ${Object.keys(e.meta).length ? JSON.stringify(e.meta) : ''}`);
    return [
      `=== Debug Log — ${now()} ===`,
      `URL: ${window.location.href}`,
      `UA:  ${navigator.userAgent}`,
      '',
      '--- CLIENT LOGS ---',
      ...clientLines,
      '',
      '--- SERVER LOGS ---',
      ...serverLines,
    ].join('\n');
  }, [entries, serverEntries]);

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
    if (tab === 'client') {
      globalEntries = [];
      listeners.forEach(fn => fn([]));
    }
  };

  const totalErrors = errorCount + serverErrorCount;

  return (
    <div className="dbg-root" ref={panelRef}>
      <button
        className={`dbg-fab ${totalErrors > 0 ? 'dbg-fab-errors' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Debug logs"
      >
        🐛{totalErrors > 0 && <span className="dbg-badge">{totalErrors}</span>}
      </button>

      {open && (
        <div className="dbg-panel">
          <div className="dbg-panel-header">
            <span className="dbg-panel-title">Debug Logs</span>
            <div className="dbg-panel-actions">
              <button
                className={`dbg-filter-btn ${tab === 'client' ? 'dbg-filter-active' : ''}`}
                onClick={() => setTab('client')}
              >
                Client ({entries.length})
              </button>
              <button
                className={`dbg-filter-btn ${tab === 'server' ? 'dbg-filter-active' : ''}`}
                onClick={() => setTab('server')}
              >
                Server ({serverEntries.length})
              </button>
              <span className="dbg-tab-divider" />
              <button
                className={`dbg-filter-btn ${filter === 'all' ? 'dbg-filter-active' : ''}`}
                onClick={() => setFilter('all')}
              >All</button>
              <button
                className={`dbg-filter-btn ${filter === 'errors' ? 'dbg-filter-active' : ''}`}
                onClick={() => setFilter('errors')}
              >Errors ({totalErrors})</button>
              <button className="dbg-action-btn dbg-copy-btn" onClick={copyAll} title="Copy all logs to clipboard">
                {copied ? '✔ Copied!' : '📋 Copy All'}
              </button>
              {tab === 'client' && <button className="dbg-action-btn" onClick={clearAll} title="Clear logs">🗑</button>}
              <button className="dbg-action-btn dbg-close-btn" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          {tab === 'client' ? (
            visible.length === 0 ? (
              <div className="dbg-empty">
                {filter === 'errors' ? 'No errors recorded 🎉' : 'No logs yet.'}
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
                    {e.detail && <div className="dbg-entry-detail">{e.detail}</div>}
                  </div>
                ))}
              </div>
            )
          ) : (
            visibleServer.length === 0 ? (
              <div className="dbg-empty">
                {filter === 'errors' ? 'No server errors 🎉' : 'No server logs yet — waiting for activity…'}
              </div>
            ) : (
              <div className="dbg-entries">
                {visibleServer.map(e => (
                  <div key={e.id} className={`dbg-entry dbg-entry-server-${e.level.toLowerCase()}`}>
                    <div className="dbg-entry-header">
                      <span className="dbg-entry-icon">{SERVER_LEVEL_ICON[e.level] ?? '⚪'}</span>
                      <span className="dbg-entry-label">{e.msg}{Object.keys(e.meta).length > 0 ? ' — ' + JSON.stringify(e.meta) : ''}</span>
                      <span className="dbg-entry-ts">{e.ts.slice(11, 23)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          <div className="dbg-panel-footer">
            <span className="dbg-footer-hint">
              {tab === 'server' ? <>Server logs poll every 2.5s — <strong>📋 Copy All</strong> includes both tabs</> : <>Paste with <strong>📋 Copy All</strong> to share with developer</>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
