

export let availableVoices: SpeechSynthesisVoice[] = []

const getAvailableVoices = (): Promise<SpeechSynthesisVoice[] | Error> => {
    return new Promise((resolve, reject) => {
        if (availableVoices.length) return availableVoices;
        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.addEventListener('voiceschanged', () => {
                const voices = speechSynthesis.getVoices();
                console.log(voices);
                availableVoices = (voices);
                resolve(voices)
            });
            speechSynthesis.addEventListener('onerror', (ev) => {
                reject(ev)
            })

            speechSynthesis.getVoices(); //trigger voiceschanged event
        } else {
            throw new Error('speechSynthesis undefined')
        }

    })

}

