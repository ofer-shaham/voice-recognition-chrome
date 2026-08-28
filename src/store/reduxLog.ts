export interface ReduxLogEntry {
  id: number;
  ts: string;
  action: string;
  payload?: unknown;
  status: string;
  line: number;
  time: number;
  youtubeState: string;
}

const MAX_ENTRIES = 200;
let nextId = 0;
let entries: ReduxLogEntry[] = [];
let listeners: Array<(next: ReduxLogEntry[]) => void> = [];

const timestamp = () => new Date().toISOString().replace('T', ' ').slice(0, 23);

export function recordReduxAction(action: string, payload: unknown, state: {
  status: string;
  currentLine: number;
  currentTime: number;
  youtubeState: string;
}) {
  // Position updates are intentionally omitted. They are high-frequency signals,
  // not useful action history, and would drown out the state transitions.
  if (action.endsWith('/playbackTimeUpdated')) return;

  const entry: ReduxLogEntry = {
    id: ++nextId,
    ts: timestamp(),
    action,
    payload,
    status: state.status,
    line: state.currentLine,
    time: state.currentTime,
    youtubeState: state.youtubeState,
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  listeners.forEach(listener => listener([...entries]));
}

export function getReduxLogs() {
  return [...entries];
}

export function subscribeReduxLogs(listener: (next: ReduxLogEntry[]) => void) {
  listeners.push(listener);
  listener([...entries]);
  return () => {
    listeners = listeners.filter(item => item !== listener);
  };
}

export function clearReduxLogs() {
  entries = [];
  listeners.forEach(listener => listener([]));
}