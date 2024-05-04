
export const translate = ({ finalTranscriptProxy, fromLang, toLang }: { finalTranscriptProxy: string, fromLang: string, toLang: string }): Promise<string> => {
    return fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(finalTranscriptProxy)}`)
        .then(res => res.json())
        .then(data => {
            const y = data[0][0][0]
            return y
        })
        .catch(err => {
            console.error(err.message); return `translation error`
        })
}
