import { useState, useRef, useCallback } from 'react';
import { MediaRecorderRecordingService } from '../services/RecordService';

interface RecordingService {
  startRecording: () => void;
  stopRecording: () => Promise<string>;
  cancelRecording: () => void;
}

export function useRecording(allowRecording: boolean) {
  const [isRecording, setIsRecording] = useState(false);
  const recordingInstance = useRef<RecordingService | null>(null);

  const startRecording = useCallback(() => {
    if (allowRecording) {
      const audioContext = new AudioContext();
      recordingInstance.current = new MediaRecorderRecordingService(audioContext);

      if (recordingInstance.current) {
        recordingInstance.current.startRecording();
        setIsRecording(true);
      }
    }
  },[allowRecording]);

  const stopRecording = useCallback(async () => {
    if (recordingInstance.current) {
      try {
        const data = await recordingInstance.current.stopRecording();
        setIsRecording(false);
        return data;
      } catch (error) {
        console.error('Error stopping recording:', error);
        return '';
      }
    }
    return '';
  },[]);

  const cancelRecording = useCallback(() => {
    if (recordingInstance.current) {
      recordingInstance.current.cancelRecording();
      setIsRecording(false);
    }
  },[]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}