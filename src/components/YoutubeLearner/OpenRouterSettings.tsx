import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_MODEL, getStoredOpenRouterApiKey, OPENROUTER_API_KEY_STORAGE, OPENROUTER_MODELS, validateOpenRouterKey } from '../../services/openRouterService';
import { YoutubeTheme } from './types';

interface Props {
  routeBase: '/youtube' | '/youtube2';
  theme: YoutubeTheme;
  onThemeChange: (theme: YoutubeTheme) => void;
  showNavigation?: boolean;
}

export default function OpenRouterSettings({ routeBase, theme, onThemeChange, showNavigation = true }: Props) {
  const navigate = useNavigate();
  const [model, setModel] = useState(() => localStorage.getItem('yt_ai_model') || DEFAULT_MODEL);
  const [level, setLevel] = useState(() => Number(localStorage.getItem('yt_ai_level') || '3'));
  const [mode, setMode] = useState<'full' | 'rows'>(() => localStorage.getItem('yt_ai_mode') === 'full' ? 'full' : 'rows');
  const [rows, setRows] = useState(() => Number(localStorage.getItem('yt_ai_rows') || '12'));
  const [apiKey, setApiKey] = useState(() => getStoredOpenRouterApiKey());
  const [showKey, setShowKey] = useState(false);
  const [validation, setValidation] = useState<{ state: 'idle' | 'checking' | 'valid' | 'invalid'; error?: string }>({ state: 'idle' });

  useEffect(() => {
    if (!apiKey) return;
    let mounted = true;
    setValidation({ state: 'checking' });
    validateOpenRouterKey(apiKey).then(result => {
      if (!mounted) return;
      setValidation(result.ok ? { state: 'valid' } : { state: 'invalid', error: result.error });
    });
    return () => { mounted = false; };
  }, []);

  const saveModel = (value: string) => {
    setModel(value);
    localStorage.setItem('yt_ai_model', value);
  };

  const saveLevel = (value: number) => { setLevel(value); localStorage.setItem('yt_ai_level', String(value)); };
  const saveMode = (value: 'full' | 'rows') => { setMode(value); localStorage.setItem('yt_ai_mode', value); };
  const saveRows = (value: number) => { setRows(value); localStorage.setItem('yt_ai_rows', String(value)); };
  const saveApiKey = (value: string) => {
    setApiKey(value);
    setValidation({ state: 'idle' });
    if (value.trim()) localStorage.setItem(OPENROUTER_API_KEY_STORAGE, value.trim());
    else localStorage.removeItem(OPENROUTER_API_KEY_STORAGE);
  };

  const handleValidate = async () => {
    setValidation({ state: 'checking' });
    const result = await validateOpenRouterKey(apiKey);
    setValidation(result.ok ? { state: 'valid' } : { state: 'invalid', error: result.error });
  };

  return (
    <div className={`yl-player yl-theme-${theme}`}>
      {showNavigation && <div className="yl-header">
        <div className="yl-header-left">
          <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/settings/translation`)}>Translation settings</button>
          <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/setup`)}>Home</button>
          <label className="yl-theme-control">
            <span className="yl-sr-only">Theme</span>
            <select className="yl-theme-select" value={theme} onChange={e => onThemeChange(e.target.value as YoutubeTheme)}>
              <option value="light">Light</option>
              <option value="blue">Blue</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </div>}
      <div className="yl-settings">
        <div className="yl-settings-heading">
          <div>
            <strong>OpenRouter settings</strong>
            <span>These settings are reserved for lesson creation and AI experiments.</span>
          </div>
          {showNavigation && <button className="yl-btn-ghost yl-btn-sm" onClick={() => navigate(`${routeBase}/settings/translation`)}>Close</button>}
        </div>
        <div className="yl-settings-global">
          <label className="yl-setting-field">
            <span>OpenRouter API key</span>
            <input className="yl-input-sm" type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => saveApiKey(e.target.value)} placeholder="sk-or-v1-…" autoComplete="off" />
            <button className="yl-btn-ghost yl-btn-sm" type="button" onClick={() => setShowKey(value => !value)}>{showKey ? 'Hide' : 'Show'}</button>
            <button className="yl-btn-secondary yl-btn-sm" type="button" onClick={handleValidate} disabled={validation.state === 'checking'}>{validation.state === 'checking' ? 'Validating…' : 'Validate key'}</button>
          </label>
          <div className="yl-setting-field">
            <span>Key status</span>
            <span className="yl-setting-info">{validation.state === 'valid' ? 'Validated' : validation.state === 'checking' ? 'Checking…' : validation.state === 'invalid' ? validation.error : 'Not validated'}</span>
          </div>
          {validation.state === 'valid' && <>
            <label className="yl-setting-field">
              <span>Model</span>
              <input className="yl-input-sm" list="yl-openrouter-models" value={model} onChange={e => saveModel(e.target.value)} />
              <datalist id="yl-openrouter-models">
                {OPENROUTER_MODELS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </datalist>
            </label>
            <label className="yl-setting-field">
              <span>Clarity level</span>
              <input type="range" min={1} max={5} step={1} value={level} onChange={e => saveLevel(Number(e.target.value))} />
              <span className="yl-setting-info">Level {level}/5</span>
            </label>
            <label className="yl-setting-field">
              <span>Translation scope</span>
              <select className="yl-select-sm" value={mode} onChange={e => saveMode(e.target.value as 'full' | 'rows')}>
                <option value="rows">Next X rows</option>
                <option value="full">Entire SRT file</option>
              </select>
            </label>
            {mode === 'rows' && <label className="yl-setting-field"><span>Rows to translate</span><input type="number" className="yl-input-sm" min={1} max={200} value={rows} onChange={e => saveRows(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} /></label>}
          </>}
        </div>
      </div>
    </div>
  );
}