import { YouTubeTranscriptApi, SRTFormatter } from 'youtube-transcript-api-js';
import fs from 'fs';

async function downloadYoutubeSRT(videoId, languageCode, outputFile) {
    const api = new YouTubeTranscriptApi();

    try {
        console.log(`Fetching transcript list for video: ${videoId}...`);
        const transcriptList = await api.list(videoId);

        let transcript;

        try {
            // 1. Try to find the transcript natively in your preferred language X
            transcript = transcriptList.findTranscript([languageCode]);
            console.log(`Found native transcript in language: ${languageCode}`);
        } catch (e) {
            // 2. Fallback: If Language X isn't manually uploaded or auto-generated,
            // check if YouTube's auto-translate feature can translate it to Language X
            console.log(`Native transcript not found. Attempting to auto-translate...`);

            // Find English (or any default) first, then translate it
            const baseTranscript = transcriptList.findTranscript(['en']); 

            if (baseTranscript.isTranslatable) {
                transcript = baseTranscript.translate(languageCode);
                console.log(`Successfully auto-translated text to: ${languageCode}`);
            } else {
                throw new Error("Transcript is not translatable into the requested language.");
            }
        }

        // 3. Fetch the actual content segments
        const fetchedTranscript = await transcript.fetch();

        // 4. Convert the data object into a standard SRT text block
        const srtFormatter = new SRTFormatter();
        const srtContent = srtFormatter.formatTranscript(fetchedTranscript);

        // 5. Save to disk
        fs.writeFileSync(outputFile, srtContent, 'utf-8');
        console.log(`Success! SRT file saved to ${outputFile}`);

    } catch (error) {
        console.error("Failed to retrieve or generate SRT:", error.message);
    }
}

// Example usage:
// Video ID: dQw4w9WgXcQ (Rick Astley)
// Target Language: 'es' (Spanish)
downloadYoutubeSRT('dQw4w9WgXcQ', 'es', 'subtitles.srt');