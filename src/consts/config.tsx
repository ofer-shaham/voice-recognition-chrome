import { isMobile } from "../services/isMobile"

export const DELAY_LISTENING_RESTART = 100
export const MAX_DELAY_BETWEEN_WORDS = 3000
export const INITIAL_DELAY_BETWEEN_WORDS = 1000

export const LOG_RECORDS_LIMIT = 20

export const instructions = {
    "welcome": { test: "hello world", explain: "say 'hello world'" },
    "speak_english": { test: 'speak english', explain: 'say "speak english" - to change the source and destination languages to english' },
    "translate_from_en_to_ru": { test: 'please translate from english to russian', explain: "say 'translate from english to russian' - for making the application recognize speech in hebrew and speak out the russian translation" },
    "translate_from_he_to_ar": { test: 'please translate from hebrew to arabic', explain: "say 'translate from hebrew to arabic' - for making the application recognize speech in hebrew and speak out the arabic translation" },
}

export const MODE_STAGE = true

export const MAX_DELAY_FOR_NOT_LISTENING = 1000

export const errorCode = {
    microphone_not_found: 'microphone device not found',
    microphone_not_found_details: 'please connect a microphone device to continue',
    microphone_no_permission: 'microphone permission denied',
    microphone_no_permission_details: 'please enable microphone permission to continue',
}

const newLocal = 'he-IL'
export const initialFromLang = newLocal
export const initialToLang = isMobile ? 'ar-AE' : 'ru-RU'

// eslint-disable-next-line no-restricted-globals
export const MODE_DEV = location.hostname === 'localhost'
export const DEBOUNCE_TEXT_DELAY = 1500

export const bookExample = {url: './fixtures/keidar.txt', fromLang: 'ar-EG', toLang:'he-IL'}
 