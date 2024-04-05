export const DELAY_LISTENING_RESTART = 1000
export const MAX_DELAY_BETWEEN_RECOGNITIONS = 3000

export const instructions = {
    "speak_english": { test: 'speak english', explain: 'say "speak english" - for making the application repeat what you say in english' },
    "translate_from_en_to_ru": { test: 'please translate from hebrew to russian', explain: "say 'translate from hebrew to russian' - for making the application recognize speech in hebrew and speak out the russian translation" },
    "translate_from_he_to_ar": { test: 'please translate from hebrew to arabic', explain: "say 'translate from hebrew to arabic' - for making the application recognize speech in hebrew and speak out the arabic translation" },
    "welcome": { test: "hello world", explain: "say 'hello world' - to translater from english" }
}
