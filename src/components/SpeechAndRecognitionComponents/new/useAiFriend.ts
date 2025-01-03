import { useState, useEffect } from 'react';
import axios from 'axios';

const settings = {
    url: 'https://api-git-main-ofershahams-projects.vercel.app/ai/logic',
    defaultPrompt: "you're an arabic and hebrew teacher. \
     you prefer using words which are similar in both languages. \
     you like to teach by using proverbs/idioms/traditional culture tales. \
     your answer will repeat the request's words and create a dialog which use similar and relative words. your answer will contain atleast 10 short sentences of a dialog between 2 children which comes to learn each other's language. \
     use response format: \
     <language_iso_code:string,text:string>[]"
}

// Define a set of valid language codes
const validLanguageCodes = new Set(['ar', 'he', 'en', 'fr', 'es', 'de']); // Add more valid codes as needed

export interface ISentence {
    lang_code: string;
    text: string;
}

export type AiAnswerFormat = {
    verifiedResponse: boolean;
    sentences: ISentence[];
    verificationExceptions: string[]; // Array to hold exceptions
};
export interface useLanguageTextProps {

    fromLang: string;
    inputText: string;
    myPrompt: string | null;
}

const useAiFriend = (props: useLanguageTextProps): AiAnswerFormat => {
    const { fromLang, inputText, myPrompt } = props;

    const [languageTexts,
        setLanguageTexts] = useState<AiAnswerFormat>({
            verifiedResponse: false,
            sentences: [],
            verificationExceptions: []
        });

    const isValidLanguageCode = (langCode: string) => {
        return validLanguageCodes.has(langCode);
    };

    useEffect(() => {

        if (!inputText.length)
            return
        const fetchLanguageTexts = async () => {
            try {
                const response = await axios.get(settings.url, {
                    params: {
                        q: inputText,
                        logic: myPrompt && myPrompt.length ? myPrompt : settings.defaultPrompt
                    }
                });

                console.info({ response });

                const verifiedLanguageTexts: AiAnswerFormat = response.data;
                // Initialize arrays for valid sentences and exceptions
                const validSentences: ISentence[] = [];
                const exceptions: string[] = [];

                // Validate language codes
                verifiedLanguageTexts.sentences.forEach(sentence => {
                    if (isValidLanguageCode(sentence.lang_code)) {
                        validSentences.push(sentence);
                    } else {
                        exceptions.push(`Invalid language code: ${sentence.lang_code}`);
                    }
                });

                // Set the language texts with valid sentences and exceptions
                setLanguageTexts({
                    verifiedResponse: validSentences.length > 0,
                    sentences: validSentences,
                    verificationExceptions: exceptions
                });

            } catch (error) {
                console.error('Error fetching language texts:', error);
                setLanguageTexts({
                    verifiedResponse: false,
                    sentences: [],
                    verificationExceptions: [`Error fetching data: ${(error as Error)?.message}`]
                });
            }
        };

        fetchLanguageTexts();
    }, [fromLang, inputText, myPrompt]);

    return languageTexts;
};

export default useAiFriend;