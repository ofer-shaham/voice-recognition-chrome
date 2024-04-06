export const DELAY_LISTENING_RESTART = 1000
export const MAX_DELAY_BETWEEN_RECOGNITIONS = 3000

export const instructions = {
    "welcome": { test: "hello world", explain: "say 'hello world'" },
    "speak_english": { test: 'speak english', explain: 'say "speak english" - to change the source and destination languages to english' },
    "translate_from_en_to_ru": { test: 'please translate from english to russian', explain: "say 'translate from english to russian' - for making the application recognize speech in hebrew and speak out the russian translation" },
    "translate_from_he_to_ar": { test: 'please translate from hebrew to arabic', explain: "say 'translate from hebrew to arabic' - for making the application recognize speech in hebrew and speak out the arabic translation" },
}
