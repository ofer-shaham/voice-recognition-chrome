import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_MODEL, DEFAULT_OPENROUTER_MAX_TOKENS, getStoredOpenRouterApiKey, getStoredOpenRouterMaxTokens, OPENROUTER_API_KEY_STORAGE, OPENROUTER_MAX_TOKENS_STORAGE, OPENROUTER_MODELS, OPENROUTER_VALIDATED_KEY_STORAGE, validateOpenRouterKey } from '../../services/openRouterService';
import { YtProject, YoutubeTheme } from './types';
import { generateLesson, LessonRow } from './lesson';

interface Props {
    routeBase: '/youtube' | '/youtube2';
    theme: YoutubeTheme;
    onThemeChange: (theme: YoutubeTheme) => void;
    showNavigation?: boolean;
    project?: YtProject | null;
}

export default function OpenRouterSettings({ routeBase, theme, onThemeChange, showNavigation = true, project }: Props) {
    const navigate = useNavigate();
    const [model, setModel] = useState(() => localStorage.getItem('yt_ai_model') || DEFAULT_MODEL);
    const [level, setLevel] = useState(() => Math.min(5, Math.max(1, Number(localStorage.getItem('yt_ai_level') || '3'))));
    const [mode, setMode] = useState<'full' | 'rows'>(() => localStorage.getItem('yt_ai_mode') === 'full' ? 'full' : 'rows');
    const [rows, setRows] = useState(() => Number(localStorage.getItem('yt_ai_rows') || '12'));
    const [maxTokens, setMaxTokens] = useState(() => getStoredOpenRouterMaxTokens());
    const [apiKey, setApiKey] = useState(() => getStoredOpenRouterApiKey());
    const [showKey, setShowKey] = useState(false);
    const [validation, setValidation] = useState<{ state: 'idle' | 'checking' | 'valid' | 'invalid'; error?: string }>({ state: 'idle' });
    const [testRows, setTestRows] = useState<LessonRow[]>([]);
    const [testState, setTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [testError, setTestError] = useState('');
    const [freeModels, setFreeModels] = useState(OPENROUTER_MODELS);

    useEffect(() => {
        fetch('/api/free-models')
            .then(response => response.ok ? response.json() : Promise.reject(new Error(`Free model list unavailable (${response.status})`)))
            .then(data => {
                if (Array.isArray(data.models) && data.models.length > 0) {
                    setFreeModels(data.models);
                    if (!data.models.some((option: { id: string }) => option.id === model)) saveModel(data.models[0].id);
                }
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!apiKey) return;
        let mounted = true;
        setValidation({ state: 'checking' });
        validateOpenRouterKey(apiKey).then(result => {
            if (!mounted) return;
            if (result.ok) localStorage.setItem(OPENROUTER_VALIDATED_KEY_STORAGE, apiKey.trim());
            else localStorage.removeItem(OPENROUTER_VALIDATED_KEY_STORAGE);
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
    const saveMaxTokens = (value: number) => {
        const next = Math.max(0, Math.min(16384, Math.round(value) || DEFAULT_OPENROUTER_MAX_TOKENS));
        setMaxTokens(next);
        localStorage.setItem(OPENROUTER_MAX_TOKENS_STORAGE, String(next));
    };
    const saveApiKey = (value: string) => {
        setApiKey(value);
        setValidation({ state: 'idle' });
        localStorage.removeItem(OPENROUTER_VALIDATED_KEY_STORAGE);
        if (value.trim()) localStorage.setItem(OPENROUTER_API_KEY_STORAGE, value.trim());
        else localStorage.removeItem(OPENROUTER_API_KEY_STORAGE);
    };

    const handleValidate = async () => {
        setValidation({ state: 'checking' });
        const result = await validateOpenRouterKey(apiKey);
        if (result.ok) localStorage.setItem(OPENROUTER_VALIDATED_KEY_STORAGE, apiKey.trim());
        else localStorage.removeItem(OPENROUTER_VALIDATED_KEY_STORAGE);
        setValidation(result.ok ? { state: 'valid' } : { state: 'invalid', error: result.error });
    };

    const handleTestLesson = async () => {
        if (!project) return;
        setTestState('running');
        setTestError('');
        try {
            setTestRows(await generateLesson(project, 1, 3, false, level));
            setTestState('success');
        } catch (error) {
            setTestError(error instanceof Error ? error.message : String(error));
            setTestState('error');
        }
    };

    return (
        <div className={`yl-player yl-theme-${theme}`}>
            {showNavigation && <div className="yl-header">
                <div className="yl-header-left">
                    <button className="yl-btn-ghost" onClick={() => navigate(`${routeBase}/settings`)}>Settings</button>
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
                <div className="yl-settings-tabs" role="tablist" aria-label="YouTube settings">
                    <button className="yl-settings-tab" role="tab" onClick={() => navigate(`${routeBase}/settings/translation`)}>Translation</button>
                    <button className="yl-settings-tab yl-settings-tab-active" role="tab" aria-selected="true">OpenRouter</button>
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
                            <span>Free model</span>
                            <select className="yl-select-sm" value={freeModels.some(option => option.id === model) ? model : ''}
                                onChange={e => { if (e.target.value) saveModel(e.target.value); }}>
                                <option value="">Choose a free model</option>
                                {freeModels.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                        </label>
                        <label className="yl-setting-field">
                            <span>Model ID</span>
                            <input className="yl-input-sm" type="text" value={model} onChange={e => saveModel(e.target.value)} placeholder="provider/model[:variant]" />
                        </label>
                        <label className="yl-setting-field">
                            <span>Clarity level</span>
                            <input type="range" min={1} max={5} step={1} value={level} onChange={e => saveLevel(Number(e.target.value))} />
                            <span className="yl-setting-info">Level {level}/5</span>
                        </label>
                        <label className="yl-setting-field">
                            <span>Maximum output tokens</span>
                            <input type="number" className="yl-input-sm" min={256} max={16384} step={256} value={maxTokens} onChange={e => saveMaxTokens(Number(e.target.value))} />
                            <span className="yl-setting-info">Lower values reduce credit usage</span>
                        </label>
                        <label className="yl-setting-field">
                            <span>Translation scope</span>
                            <select className="yl-select-sm" value={mode} onChange={e => saveMode(e.target.value as 'full' | 'rows')}>
                                <option value="rows">Next X rows</option>
                                <option value="full">Entire SRT file</option>
                            </select>
                        </label>
                        {mode === 'rows' && <label className="yl-setting-field"><span>Rows to translate</span><input type="number" className="yl-input-sm" min={1} max={200} value={rows} onChange={e => saveRows(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} /></label>}
                        <div className="yl-setting-field">
                            <span>Lesson generation test</span>
                            <button className="yl-btn-secondary yl-btn-sm" type="button" onClick={handleTestLesson} disabled={!project || testState === 'running'}>
                                {testState === 'running' ? 'Testing…' : 'Test first 3 rows'}
                            </button>
                            {!project && <span className="yl-setting-info">Load a YouTube project first</span>}
                        </div>
                        {testState === 'error' && <p className="yl-error">{testError}</p>}
                        {testState === 'success' && <div className="yl-settings-cols">{testRows.slice(0, 3).map((row, index) => <div className="yl-col-card" key={`${index}-${row.source}`}><div className="yl-col-card-name">{row.source}</div><div className="yl-col-card-body">{row.lesson}</div></div>)}</div>}
                    </>}
                </div>
            </div>
        </div>
    );
}