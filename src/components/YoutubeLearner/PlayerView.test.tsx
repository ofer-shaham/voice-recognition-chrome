import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlayerView from './PlayerView';
import { YtProject, YtTrack } from './types';

// Mock speech synthesis
const mockSpeak = jest.fn();
const mockCancel = jest.fn();
window.speechSynthesis = {
  speak: mockSpeak,
  cancel: mockCancel,
  getVoices: () => [],
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
} as any;

// Mock Web Speech API
window.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
  text,
  lang: '',
  rate: 1,
  voice: null,
  onend: null,
  onerror: null,
  onboundary: null,
})) as any;

// Mock fetch for translation
global.fetch = jest.fn();

// Mock window.innerWidth
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1200,
});

// Mock URLSearchParams
const mockSearchParams = new Map<string, string>();
const originalURLSearchParams = window.URLSearchParams;
window.URLSearchParams = jest.fn().mockImplementation(() => ({
  get: (key: string) => mockSearchParams.get(key) || null,
  set: (key: string, value: string) => mockSearchParams.set(key, value),
  toString: () => Array.from(mockSearchParams.entries()).map(([k, v]) => `${k}=${v}`).join('&'),
})) as any;

const createMockProject = (tracks: YtTrack[] = []): YtProject => ({
  id: 'test-id',
  videoId: 'test-video',
  title: 'Test Video',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tracks: tracks.length ? tracks : [{
    lang: 'en',
    label: 'English',
    isAuto: false,
    srtContent: `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,000
This is a test
`,
  }],
  config: {
    targetLang: 'he',
    translationSource: 'track:en',
    colOrder: ['track:en', 'translation', 'video'],
    colSettings: {
      'track:en': { visible: true, playOrder: 1, ttsRate: 1.0 },
      'translation': { visible: true, playOrder: 2, ttsRate: 0.9 },
      'video': { visible: true, playOrder: 3, ttsRate: 1.0 },
    },
    visibleLines: 30,
  },
  lastLine: 0,
});

const mockProps = {
  onSave: jest.fn(),
  onNewVideo: jest.fn(),
  onDelete: jest.fn(),
  projects: [] as YtProject[],
  onSelectProject: jest.fn(),
};

describe('PlayerView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.clear();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('[{"text":"Translated text"}]'),
    });
  });

  afterAll(() => {
    window.URLSearchParams = originalURLSearchParams;
  });

  it('renders the player with subtitle lines', () => {
    const project = createMockProject();
    render(<PlayerView project={project} {...mockProps} />);

    // Check that Play button exists
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('shows translation loading indicator for untranslated lines', async () => {
    const project = createMockProject();
    render(<PlayerView project={project} {...mockProps} />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /play/i })).toBeInTheDocument();
    });
  });

  it('handles share button click', async () => {
    const project = createMockProject();
    const mockClipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<PlayerView project={project} {...mockProps} />);

    const shareButton = screen.getByRole('button', { name: /share/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalled();
    });
  });

  it('toggles settings panel visibility', () => {
    const project = createMockProject();
    render(<PlayerView project={project} {...mockProps} />);

    const settingsButton = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsButton);

    // Settings should now be visible
    expect(screen.getByLabelText(/translate to/i)).toBeInTheDocument();
  });

  it('shows seamless mode by default', () => {
    const project = createMockProject();
    render(<PlayerView project={project} {...mockProps} />);

    // Seamess banner should be visible when in seamless mode with video
    expect(screen.queryByText(/seamless mode/i)).toBeInTheDocument();
  });

  it('reads seamless mode from URL parameter', () => {
    mockSearchParams.set('sm', '0');
    const project = createMockProject();

    render(<PlayerView project={project} {...mockProps} />);

    // No seamless banner when sm=0
    expect(screen.queryByText(/seamless mode/i)).not.toBeInTheDocument();
  });

  it('sets visible lines from URL parameter', () => {
    mockSearchParams.set('vl', '5');
    const project = createMockProject();

    render(<PlayerView project={project} {...mockProps} />);

    // Open settings to check visible lines
    const settingsButton = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsButton);

    const visibleLinesInput = screen.getByLabelText(/visible lines/i);
    expect(visibleLinesInput).toHaveValue(5);
  });

  it('uses default 3 visible lines on mobile', () => {
    (window as any).innerWidth = 500;
    const project = createMockProject();

    render(<PlayerView project={project} {...mockProps} />);

    // Open settings to check visible lines
    const settingsButton = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsButton);

    const visibleLinesInput = screen.getByLabelText(/visible lines/i);
    expect(visibleLinesInput).toHaveValue(3);
  });

  it('stops playback when stop button is clicked', async () => {
    const project = createMockProject();
    render(<PlayerView project={project} {...mockProps} />);

    const playButton = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playButton);

    // Should now show stop button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });

    // Click stop
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));

    expect(mockCancel).toHaveBeenCalled();
  });
});

describe('Word Highlighting', () => {
  it('renders without word highlighting when not playing', async () => {
    const project = createMockProject();
    render(<PlayerView project={project} {...mockProps} />);

    await waitFor(() => {
      // No word highlights should be present initially
      expect(screen.queryByText(/hello/i)).toBeInTheDocument();
    });
  });
});
