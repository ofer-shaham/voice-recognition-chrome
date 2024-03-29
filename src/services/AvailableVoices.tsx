

export let availableVoices: SpeechSynthesisVoice[] = []

function setAvailableVoices() {
    const populateVoiceList = () => {
        if (typeof speechSynthesis === 'undefined') {
            return;
        }

        availableVoices = speechSynthesis.getVoices();

        console.log(availableVoices.map(voice => ({
            name: voice.name,
            lang: voice.lang,
            default: voice.default,
            localService: voice.localService,
            voiceURI: voice.voiceURI
        })));
    };

    if (
        typeof speechSynthesis !== 'undefined' &&
        speechSynthesis.onvoiceschanged !== undefined
    ) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }
}

setAvailableVoices()
