import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/appHub.css';

const APPS = [
  {
    path: '/listen',
    emoji: '🎤',
    title: 'Listen, Translate & Speak',
    desc: 'Real-time speech recognition, translation and text-to-speech in 40+ languages.',
    tags: ['speech', 'translation', 'mic'],
  },
  {
    path: '/youtube',
    emoji: '📺',
    title: 'YouTube Language Learner',
    desc: 'Load any YouTube video and follow along with synchronized multi-language transcripts.',
    tags: ['youtube', 'transcripts', 'subtitles'],
  },
  {
    path: '/ai-conversation',
    emoji: '🤖',
    title: 'AI Conversation',
    desc: 'Voice-enabled chat powered by OpenRouter. Practice conversations with any free LLM.',
    tags: ['AI', 'voice', 'chat'],
  },
  {
    path: '/simultanuos_translation?showMobile=true&from-lang=he-IL&to-lang=ru-RU',
    emoji: '🌐',
    title: 'Simultaneous Translation',
    desc: 'Live interpreter mode — translate spoken words in real time as you talk.',
    tags: ['simultaneous', 'interpreter'],
  },
  {
    path: '/proverb',
    emoji: '📚',
    title: 'Proverbs',
    desc: 'Browse a multilingual collection of proverbs with translations and audio playback.',
    tags: ['proverbs', 'language'],
  },
];

const API_LINKS = [
  { href: '/api-docs', label: '📄 API Docs (Swagger)' },
  { href: '/api/health', label: '💓 Health Check' },
  { href: '/api/logs', label: '🪵 Server Logs' },
];

const AppHub: React.FC = () => (
  <div className="hub-root">
    <header className="hub-header">
      <h1 className="hub-title">🗣️ Voice & Language Tools</h1>
      <p className="hub-subtitle">
        A suite of browser-native apps for speech recognition, real-time translation and AI conversation.
      </p>
    </header>

    <main className="hub-grid">
      {APPS.map(app => (
        <Link key={app.path} to={app.path} className="hub-card">
          <span className="hub-card-emoji">{app.emoji}</span>
          <h2 className="hub-card-title">{app.title}</h2>
          <p className="hub-card-desc">{app.desc}</p>
          <div className="hub-card-tags">
            {app.tags.map(t => <span key={t} className="hub-tag">{t}</span>)}
          </div>
        </Link>
      ))}
    </main>

    <footer className="hub-api-bar">
      <span className="hub-api-label">Developer:</span>
      {API_LINKS.map(l => (
        <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="hub-api-link">
          {l.label}
        </a>
      ))}
    </footer>
  </div>
);

export default AppHub;
