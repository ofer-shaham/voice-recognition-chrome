import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkServerKey, DEFAULT_MODEL, OPENROUTER_MODELS } from '../../services/openRouterService';
import { YoutubeTheme } from './types';

interface Props {
  routeBase: '/youtube' | '/youtube2';
  theme: YoutubeTheme;
  onThemeChange: (theme: YoutubeTheme) => void;
}

export default function OpenRouterSettings({ routeBase, theme, onThemeChange }: Props) {
  const navigate = useNavigate();
  const [model, setModel] = useState(() => localStorage.getItem('yt_ai_model') || DEFAULT_MODEL);
  const [serverKeyAvailable, setServerKeyAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    checkServerKey().then(value => { if (mounted) setServerKeyAvailable(value); });
    return () => { mounted = false; };
  }, []);

  const saveModel = (value: string) => {
    setModel(value);
    localStorage.setItem('yt_ai_model', value);
  };

  return (
    <div className={`yl-player yl-theme-${theme}`}>
      <div className="yl-header">
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
      </div>
      <div className="yl-settings">
        <div className="yl-settings-heading">
          <div>
            <strong>OpenRouter settings</strong>
            <span>These settings are reserved for lesson creation and AI experiments.</span>
          </div>
          <button className="yl-btn-ghost yl-btn-sm" onClick={() => navigate(`${routeBase}/settings/translation`)}>Close</button>
        </div>
        <div className="yl-settings-global">
          <label className="yl-setting-field">
            <span>Model</span>
            <input className="yl-input-sm" list="yl-openrouter-models" value={model} onChange={e => saveModel(e.target.value)} />
            <datalist id="yl-openrouter-models">
              {OPENROUTER_MODELS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </datalist>
          </label>
          <div className="yl-setting-field">
            <span>Server key</span>
            <span className="yl-setting-info">{serverKeyAvailable === null ? 'Checking…' : serverKeyAvailable ? 'Available' : 'Not configured'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}