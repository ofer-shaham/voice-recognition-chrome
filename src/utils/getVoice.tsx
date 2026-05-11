
const cachedVoices: any = {}
let _availableVoices: SpeechSynthesisVoice[] = []

export function getVoice(language: string, isMobile: boolean): SpeechSynthesisVoice | null {
    if (!_availableVoices.length) {
        return null
    }
    if (cachedVoices.hasOwnProperty(language)) {
        console.log('return voice', { cached_voice: cachedVoices[language] }); return cachedVoices[language]
    }
    const lowercasedLanguage = isMobile ? language.replace('-', '_') : language
    const filteredVoices = _availableVoices.filter((r: SpeechSynthesisVoice) => r.lang === lowercasedLanguage)
    const length = filteredVoices.length
    const voice = filteredVoices[Math.floor(Math.random() * length)]
    //cache voice
    cachedVoices[language] = voice
    console.log('return voice', { voice })
    return voice
}

export function populateAvailableVoices(availableVoices: SpeechSynthesisVoice[]) {
    _availableVoices = availableVoices
}