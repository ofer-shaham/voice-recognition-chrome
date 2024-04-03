import React, {  useRef } from 'react';




interface VoiceRecorderProps {
    stream: MediaStream | null;
}


export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ stream }) => {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const startRecording = () => {
        if (stream) {
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.addEventListener('dataavailable', (event) => {
                chunksRef.current.push(event.data);
            });

            mediaRecorder.start();
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
        }
    };

    const downloadRecording = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recording.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const playRecording = () => {
        if (audioRef.current) {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            audioRef.current.src = url;
            audioRef.current.play();
        }
    };

    return (
        <div>
            <button onClick={startRecording}>Start Recording</button>
            <button onClick={stopRecording}>Stop Recording</button>
            <button onClick={downloadRecording}>Download Recording</button>
            <button onClick={playRecording}>Play Recording</button>
            <audio ref={audioRef} controls></audio>
        </div>
    );
};

