export interface RecordingService {
    startRecording: () => void;
    stopRecording: () => Promise<string>;
}

  
  export class MediaRecorderRecordingService implements RecordingService {
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private audioContext: AudioContext;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  
    constructor(audioContext: AudioContext) {
      this.audioContext = audioContext;
    }
  
    startRecording(): void {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream: MediaStream) => {
          this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
          this.mediaRecorder = new MediaRecorder(stream);
          this.mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
            this.recordedChunks.push(event.data);
          });
          this.mediaRecorder.start();
        })
        .catch((error: any) => {
          console.error('Error starting recording:', error);
        });
    }
  
    stopRecording(): Promise<string> {
      return new Promise((resolve, reject) => {
        if (!this.mediaRecorder) {
          reject('MediaRecorder is not initialized');
          return;
        }
  
        this.mediaRecorder.addEventListener('stop', () => {
          const recordedBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result?.toString().split(',')[1] || '';
            resolve(base64String);
          };
          reader.readAsDataURL(recordedBlob);
        });
  
        this.mediaRecorder.stop();
  
        if (this.mediaStreamSource) {
          this.mediaStreamSource.disconnect();
        }
      });
    }
  }