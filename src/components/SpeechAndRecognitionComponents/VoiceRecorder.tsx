import React, { useRef, useEffect } from 'react';

export const VoiceRecorder: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const getMicrophone = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
            } catch (error) {
                console.error(error);
            }
        };

        getMicrophone();
    }, []);

    return (
        <div style={{ width: '100%', background: 'darkblue' }}>
            <canvas ref={canvasRef} style={{ width: '100%' }} height={100}></canvas>
        </div>
    );
};