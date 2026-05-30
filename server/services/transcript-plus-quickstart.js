import express from 'express';
import { 
  fetchTranscript, 
  FsCache,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptInvalidLangError
} from 'youtube-transcript-plus';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize the File System cache with a 1-day TTL as default
const transcriptCache = new FsCache('/tmp/youtube-transcript-cache', 86400000);

app.use(express.json());

// Helper function to format segments into SRT or VTT
function formatTranscript(segments, format) {
  if (format === 'json') return segments;

  return segments.map((seg, index) => {
    const start = formatTime(seg.offset / 1000, format);
    const end = formatTime((seg.offset + seg.duration) / 1000, format);
    const text = seg.text.replace(/\n/g, ' ');

    if (format === 'vtt') {
      return `${index + 1}\n${start} --> ${end}\n${text}\n\n`;
    }
    // Default SRT
    return `${index + 1}\n${start.replace('.', ',')} --> ${end.replace('.', ',')}\n${text}\n\n`;
  }).join('').trim();
}

function formatTime(seconds, format) {
  const date = new Date(0);
  date.setSeconds(seconds);
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  const timeString = date.toISOString().substr(11, 8);
  return format === 'vtt' ? `${timeString}.${ms}` : `${timeString},${ms}`;
}

---

### Endpoints

// 1. Get supported languages and video details
app.get('/transcript/languages', async (req, res, next) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'Missing required query parameter: videoId (URL or ID)' });
  }

  try {
    const result = await fetchTranscript(videoId, { 
      cache: transcriptCache,
      videoDetails: true 
    });

    // youtube-transcript-plus returns languages inside the videoDetails or availableLangs arrays
    res.json({
      videoDetails: {
        title: result.videoDetails?.title,
        author: result.videoDetails?.author,
        lengthSeconds: result.videoDetails?.lengthSeconds,
        viewCount: result.videoDetails?.viewCount,
      },
      availableLanguages: result.availableLangs || []
    });
  } catch (error) {
    next(error);
  }
});

// 2. Fetch transcript by language and format
app.get('/transcript', async (req, res, next) => {
  const { videoId, lang, format = 'srt' } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'Missing required query parameter: videoId (URL or ID)' });
  }

  const allowedFormats = ['json', 'srt', 'vtt'];
  if (!allowedFormats.includes(format.toLowerCase())) {
    return res.status(400).json({ error: `Invalid format. Allowed formats: ${allowedFormats.join(', ')}` });
  }

  try {
    const options = {
      cache: transcriptCache,
      videoDetails: true
    };

    if (lang) {
      options.lang = lang;
    }

    const result = await fetchTranscript(videoId, options);
    const formattedData = formatTranscript(result.segments, format.toLowerCase());

    if (format.toLowerCase() === 'json') {
      res.json(formattedData);
    } else {
      res.setHeader('Content-Type', 'text/plain');
      res.send(formattedData);
    }
  } catch (error) {
    next(error);
  }
});

---

### Meaningful Error Handling Middleware

app.use((err, req, res, next) => {
  if (err instanceof YoutubeTranscriptVideoUnavailableError) {
    return res.status(404).json({
      error: 'VideoUnavailable',
      message: `The video is unavailable.`,
      videoId: err.videoId
    });
  } 

  if (err instanceof YoutubeTranscriptDisabledError) {
    return res.status(403).json({
      error: 'TranscriptsDisabled',
      message: `Transcripts are disabled for this video.`,
      videoId: err.videoId
    });
  } 

  if (err instanceof YoutubeTranscriptNotAvailableError) {
    return res.status(404).json({
      error: 'TranscriptNotAvailable',
      message: `No transcript is available for this video.`,
      videoId: err.videoId
    });
  } 

  if (err instanceof YoutubeTranscriptNotAvailableLanguageError) {
    return res.status(406).json({
      error: 'LanguageNotAvailable',
      message: `The requested language '${err.lang}' is not available.`,
      requestedLanguage: err.lang,
      availableLanguages: err.availableLangs
    });
  } 

  if (err instanceof YoutubeTranscriptInvalidLangError) {
    return res.status(400).json({
      error: 'InvalidLanguageCode',
      message: `The provided language code '${err.lang}' is invalid.`,
      lang: err.lang
    });
  }

  // Fallback for unexpected errors
  console.error('Unexpected Error:', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: err.message || 'An unexpected error occurred.'
  });
});

app.listen(PORT, () => {
  console.log(`YouTube Transcript service is running on http://localhost:${PORT}`);
});