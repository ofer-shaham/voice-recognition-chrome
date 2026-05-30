import { fetchTranscript } from 'youtube-transcript-plus';

// Fetches the raw text segments in French
fetchTranscript('K3WX2hBtewM', { lang: 'fr' })
    .then(segments => {
        // Returns an array of: [{ text: "...", duration: 2.1, offset: 4.5 }]
        // You would then map this structure into standard SRT time-blocks
        console.log(segments);
    })
    .catch(console.error);