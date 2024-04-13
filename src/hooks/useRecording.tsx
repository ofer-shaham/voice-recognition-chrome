import { useState, useRef } from 'react';
import { MediaRecorderRecordingService } from '../services/RecordService';

interface RecordingService {
    startRecording: () => void;
    stopRecording: () => Promise<string>;
    cancelRecording: () => void;
}

export function useRecording() {
    const [isRecording, setIsRecording] = useState(false);
    const recordingInstance = useRef<RecordingService | null>(null);

    const startRecording = () => {
        const audioContext = new AudioContext();
        recordingInstance.current = new MediaRecorderRecordingService(audioContext);

        if (recordingInstance.current) {
            recordingInstance.current.startRecording();
            setIsRecording(true);
        }
    };

    const stopRecording = async () => {
        if (recordingInstance.current) {
            try {
                const data = await recordingInstance.current.stopRecording();
                setIsRecording(false);
                // setRecordedData(data);
                return data;
            } catch (error) {
                console.error('Error stopping recording:', error);
                return ''
            }
        }
        return ''
    };

    const cancelRecording = () => {
        if (recordingInstance.current) {
            recordingInstance.current.cancelRecording();
            setIsRecording(false);
        }
    };

    return {
        isRecording,
        startRecording,
        stopRecording,
        cancelRecording,
    };
}