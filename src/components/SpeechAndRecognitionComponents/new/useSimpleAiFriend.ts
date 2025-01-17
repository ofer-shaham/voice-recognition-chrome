import { useState, useEffect } from 'react';
import axios from 'axios';

const settings = {
    url: 'https://api-git-main-ofershahams-projects.vercel.app/ai/logic'
}
const settings2 = {
    url: 'https://apii.maulanaa.xyz/ai/logic',
    defaultPrompt: "you're an arabic and hebrew teacher.\
     you prefer using words which are similar in both languages.\
     you like to teach by using proverbs/idioms/traditional culture tales.\
     use strict response format:\
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

const useSimpleAiFriend = (props: useLanguageTextProps): string => {

    debugger;
    const { fromLang, inputText, myPrompt } = props;

    const [languageText,
        setLanguageText] = useState<string>("");



    useEffect(() => {
        const fetchLanguageTexts = async () => {
            try {
                const response = await axios.get(settings.url, {
                    params: {
                        q: inputText,
                        logic: 'answer'
                        // logic: myPrompt && myPrompt.length ? myPrompt : settings.defaultPrompt
                    }
                });

                console.info('answer', { response });

                const answer: string = response.data;
                debugger;

                // Set the language texts with valid sentences and exceptions
                setLanguageText(answer);

            } catch (error) {
                console.error('Error fetching language texts:', error);
                setLanguageText((error as Error)?.message);
            }
        };

        fetchLanguageTexts();
    }, [fromLang, inputText, myPrompt]);

    return languageText;
};

export default useSimpleAiFriend;