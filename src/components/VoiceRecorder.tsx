import React, { useRef, useEffect } from 'react';

interface VoiceRecorderProps {
    stream: MediaStream | null;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ stream }) => {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (stream) {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            const canvas = canvasRef.current;
            const canvasContext = canvas?.getContext('2d');

            if (canvasContext && canvas) {
                analyser.fftSize = 2048;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const draw = () => {
                    const WIDTH = canvas.width;
                    const HEIGHT = canvas.height;

                    analyser.getByteTimeDomainData(dataArray);

                    canvasContext.clearRect(0, 0, WIDTH, HEIGHT);
                    canvasContext.lineWidth = 2;
                    canvasContext.strokeStyle = 'rgb(0, 0, 0)';
                    canvasContext.beginPath();

                    const sliceWidth = (WIDTH * 1.0) / bufferLength;
                    let x = 0;

                    for (let i = 0; i < bufferLength; i++) {
                        const v = dataArray[i] / 128.0;
                        const y = (v * HEIGHT) / 2;

                        if (i === 0) {
                            canvasContext.moveTo(x, y);
                        } else {
                            canvasContext.lineTo(x, y);
                        }

                        x += sliceWidth;
                    }

                    canvasContext.lineTo(canvas.width, canvas.height / 2);
                    canvasContext.stroke();

                    requestAnimationFrame(draw);
                };

                source.connect(analyser);
                draw();
            }
        }
    }, [stream]);

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
            <canvas ref={canvasRef} width={400} height={100}></canvas>
            <audio ref={audioRef} controls></audio>
        </div>
    );
};