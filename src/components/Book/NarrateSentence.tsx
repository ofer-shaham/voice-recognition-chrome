import { TextToSpeech } from "tts-react";

interface INarrateSentence {
    mySentence: string; lang: string; markTextAsSpoken?: true; markColor?: 'blue'; voice?: SpeechSynthesisVoice;
    rate: number
}

const NarrateSentence = (props: INarrateSentence) => {
    return (
        <TextToSpeech rate={props.rate} markTextAsSpoken={props.markTextAsSpoken} markColor={props.markColor} lang={props.lang} voice={props.voice} >
            <p>{props.mySentence}</p>
        </TextToSpeech>
    )
}
export default NarrateSentence