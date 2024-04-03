import { useState, useEffect } from 'react';

export const useMicrophoneStream = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        let mediaStream: MediaStream | null = null;

        const handleMicAccess = async () => {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setStream(mediaStream);
                // Perform any additional actions after getting the microphone stream
            } catch (error) {
                console.error('Error getting user media:', error);
                alert('Error getting user media');
            }
        };

        handleMicAccess();

        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach((track) => {
                    track.stop();
                });
            }
        };
    }, []);

    return stream;
};
