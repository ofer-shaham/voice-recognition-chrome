import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatWithAI, DEFAULT_MODEL, getStoredOpenRouterApiKey, getStoredOpenRouterMaxTokens, OPENROUTER_API_KEY_STORAGE, OPENROUTER_MAX_TOKENS_STORAGE, OPENROUTER_MODELS, OPENROUTER_VALIDATED_KEY_STORAGE, validateOpenRouterKey } from '../../services/openRouterService';
import aiConfig from '../../config/aiConfig.json';
import { YtProject, YoutubeTheme } from './types';

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
    const [level, setLevel] = useState(() => Math.min(aiConfig.maskSettings.maxDifficulty, Math.max(aiConfig.maskSettings.minDifficulty, Number(localStorage.getItem('yt_ai_level') || String(aiConfig.maskSettings.defaultDifficulty)))));
    const [maxTokens, setMaxTokens] = useState(() => getStoredOpenRouterMaxTokens());
    const [apiKey, setApiKey] = useState(() => getStoredOpenRouterApiKey());
    const [showKey, setShowKey] = useState(false);
    const [validation, setValidation] = useState<{ state: 'idle' | 'checking' | 'valid' | 'invalid'; error?: string }>({ state: 'idle' });
    const [testState, setTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [testError, setTestError] = useState('');
    const [testResponse, setTestResponse] = useState('');
    const [freeModels, setFreeModels] = useState(OPENROUTER_MODELS);
    const [freeModelsLoading, setFreeModelsLoading] = useState(false);

    const renewFreeModels = async () => {
        setFreeModelsLoading(true);
        try {
            const response = await fetch('/api/free-models', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Free model list unavailable (${response.status})`);
            const data = await response.json();
            if (Array.isArray(data.models) && data.models.length > 0) setFreeModels(data.models);
        } catch {
            // Keep the built-in list available when OpenRouter is unreachable.
        } finally {
            setFreeModelsLoading(false);
        }
    };

    useEffect(() => { void renewFreeModels(); }, []);

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
    const saveMaxTokens = (value: number) => {
        const next = value < 5 ? 5 : Math.min(aiConfig.tokenLimits.globalMaxTokensAbsoluteMax, Math.round(value));
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

    const handleTestConnection = async () => {
        setTestState('running');
        setTestError('');
        setTestResponse('');
        try {
            const result = await chatWithAI(
                [{ role: 'user', content: 'Reply with exactly: OK' }],
                model,
                apiKey,
                Math.max(32, maxTokens),
                0,
            );
            setTestResponse(result.content.trim());
            setTestState('success');
        } catch (error) {
            setTestError(error instanceof Error ? error.message : String(error));
            setTestState('error');
        }
    };

    const handleClose = () => {
        if (project) {
            navigate(`${routeBase}/view/${encodeURIComponent(project.id)}`);
        } else {
            navigate(`${routeBase}/settings`);
        }
    };

    const apiKeyIndicator = apiKey ? `...${apiKey.slice(-4)}` : 'No API key';

    return (
        <div className={`yl-player yl-theme-${theme}`}>
            {showNavigation && <div className="yl-header">
                <div className="yl-header-left">
                    <button className="yl-btn-ghost" onClick={handleClose} title="Close and return">← Back</button>
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
                <div className="yl-header-right">
                    <button className="yl-btn-ghost" onClick={handleClose} title="Close settings">✕</button>
                </div>
            </div>}
            <div className="yl-settings">
                <div className="yl-settings-heading">
                    <div>
                        <strong>OpenRouter settings</strong>
                        <span>These settings are reserved for lesson creation and AI experiments.</span>
                        <span className="yl-setting-info">API key: {apiKeyIndicator}</span>
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
                    <label className="yl-setting-field">
                        <span>Model (quick setup)</span>
                        <select className="yl-select-sm" value={freeModels.some(option => option.id === model) ? model : DEFAULT_MODEL}
                            onChange={e => saveModel(e.target.value)}>
                            <option value={DEFAULT_MODEL}>OpenRouter Auto (free)</option>
                            {freeModels.filter(option => option.id !== DEFAULT_MODEL).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                        <button className="yl-btn-ghost yl-btn-sm" type="button" onClick={() => void renewFreeModels()} disabled={freeModelsLoading}>
                            {freeModelsLoading ? 'Renewing…' : 'Renew free models'}
                        </button>
                    </label>
                    {validation.state === 'valid' && <>
                        <label className="yl-setting-field">
                            <span>Model ID</span>
                            <input className="yl-input-sm" type="text" value={model} onChange={e => saveModel(e.target.value)} placeholder="provider/model[:variant]" />
                        </label>
                        <label className="yl-setting-field">
                            <span>Clarity level</span>
                            <input type="range" min={aiConfig.maskSettings.minDifficulty} max={aiConfig.maskSettings.maxDifficulty} step={1} value={level} onChange={e => saveLevel(Number(e.target.value))} />
                            <span className="yl-setting-info">Level {level}/{aiConfig.maskSettings.maxDifficulty}</span>
                        </label>
                        <label className="yl-setting-field">
                            <span>Maximum output tokens</span>
                            <input type="number" className="yl-input-sm" min={5} max={aiConfig.tokenLimits.globalMaxTokensAbsoluteMax} step={1} value={maxTokens} onChange={e => saveMaxTokens(Number(e.target.value))} />
                            <span className="yl-setting-info">Lower values reduce credit usage</span>
                        </label>
                        <div className="yl-setting-field">
                            <span>Connection test</span>
                            <button className="yl-btn-secondary yl-btn-sm" type="button" onClick={handleTestConnection} disabled={testState === 'running'}>
                                {testState === 'running' ? 'Testing…' : 'Test OpenRouter'}
                            </button>
                        </div>
                        {testState === 'error' && <p className="yl-error">{testError}</p>}
                        {testState === 'success' && <span className="yl-setting-info">Response: {testResponse}</span>}
                    </>}
                </div>
            </div>
        </div>
    );
}