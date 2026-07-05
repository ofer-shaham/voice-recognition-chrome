/**
 * @deprecated This file uses youtube-transcript-plus which requires Node >=20.
 * Use youtube-transcript-api-js instead (method 2 in youtube-transcript.js).
 * This file is kept for reference only.
 */
// import { fetchTranscript } from 'youtube-transcript-plus';

// Fetches the raw text segments in French (DEPRECATED - requires Node >=20)
fetchTranscript('K3WX2hBtewM', { lang: 'fr' })
    .then(segments => {
        // Returns an array of: [{ text: "...", duration: 2.1, offset: 4.5 }]
        // You would then map this structure into standard SRT time-blocks
        console.log(segments);
    })
    .catch(console.error);