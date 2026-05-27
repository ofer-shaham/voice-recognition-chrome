const fs = require('fs');
const path = require('path');

async function downloadTTS(text, outputFile, lang = 'en') {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodedText}`;

    try {
        const response = await fetch(url, {
            headers: {
                // Google sometimes blocks requests without a browser-like User-Agent string
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        // Convert response to a buffer and write it to disk
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        fs.writeFileSync(outputFile, buffer);
        console.log(`Success! Saved audio to ${outputFile}`);
    } catch (error) {
        console.error("Failed to download audio:", error);
    }
}

// Example usage:
// downloadTTS("I want to go home", path.join(__dirname, "home.mp3"));