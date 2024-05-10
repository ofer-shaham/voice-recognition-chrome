// Replace 'YOUR_API_KEY' with your actual API key obtained from Google Cloud Console
 

// Function to translate a word to Arabic
async function translateToArabic(word, targetLanguage) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(word)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Extract the translated word from the response
        const translatedWord = data[0][0][0];

        return translatedWord;
    } catch (error) {
        console.log('An error occurred:', error);
        return null;
    }
}

// Array of Arabic languages
const arabicLanguages = [
    "ar",       // Arabic - Standard Arabic
    "ar-EG",    // Arabic - Egypt
    "ar-SA",    // Arabic - Saudi Arabia
    "ar-AE",    // Arabic - United Arab Emirates
    "ar-MA",    // Arabic - Morocco
    "ar-DZ",    // Arabic - Algeria
    "ar-TN",    // Arabic - Tunisia
    "ar-LB",    // Arabic - Lebanon
    "ar-IQ",    // Arabic - Iraq
    "ar-JO"     // Arabic - Jordan
];

// Example usage
const word = 'Hello';

// Translate for each target language
arabicLanguages.forEach(async (targetLanguage) => {
    const translatedWord = await translateToArabic(word, targetLanguage);
    if (translatedWord) {
        console.log(`"${word}" translated to ${targetLanguage}: ${translatedWord}`);
    } else {
        console.log(`Translation to ${targetLanguage} failed.`);
    }
});