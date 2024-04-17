import { useRef, useEffect, useState, useCallback } from 'react';

interface SpeechRecognitionProps {
  onEnd?: () => void;
  onResult?: (transcript: string) => void;
  onError?: (event: SpeechRecognitionErrorEvent) => void;
}

const useEventCallback = <T extends (...args: any[]) => any>(
  fn: T,
  dependencies: any[]
) => {
  const ref = useRef<() => ReturnType<T>>(() => {
    throw new Error('Cannot call an event handler while rendering.');
  });

  useEffect(() => {
    ref.current = fn;
  }, [fn]);

  return useCallback((...args: Parameters<T>) => {
    const fn = ref.current;

    // @ts-ignore
    return fn(...args);
  }, [ref]);
};

const useSpeechRecognitionKit = (props: SpeechRecognitionProps = {}) => {
  const { onEnd = () => {}, onResult = () => {}, onError = () => {} } = props;
  const recognition = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  const processResult = (event: SpeechRecognitionEvent) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0])
      .map((result) => result.transcript)
      .join('');

    onResult(transcript);
  };

  const handleError = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === 'not-allowed') {
      recognition.current!.onend = null;
      setListening(false);
    }
    onError(event);
  };

  const listen = useEventCallback((args: {
    lang?: string;
    interimResults?: boolean;
    continuous?: boolean;
    maxAlternatives?: number;
    grammars?: SpeechGrammarList;
  } = {}) => {
    if (listening || !supported) return;
    const {
      lang = '',
      interimResults = true,
      continuous = false,
      maxAlternatives = 1,
      grammars,
    } = args;
    setListening(true);
    recognition.current!.lang = lang;
    recognition.current!.interimResults = interimResults;
    recognition.current!.onresult = processResult;
    recognition.current!.onerror = handleError;
    recognition.current!.continuous = continuous;
    recognition.current!.maxAlternatives = maxAlternatives;
    if (grammars) {
      recognition.current!.grammars = grammars;
    }
    // SpeechRecognition stops automatically after inactivity
    // We want it to keep going until we tell it to stop
    recognition.current!.onend = () => recognition.current!.start();
    recognition.current!.start();
  }, [listening, supported, recognition]);

  const stop = useEventCallback(() => {
    if (!listening || !supported) return;
    recognition.current!.onresult = null;
    recognition.current!.onend = null;
    recognition.current!.onerror = null;
    setListening(false);
    recognition.current!.stop();
    onEnd();
  }, [listening, supported, recognition, onEnd]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (window.SpeechRecognition) {
      setSupported(true);
      recognition.current = new window.SpeechRecognition();
    }
  }, []);

  return {
    listen,
    listening,
    stop,
    supported,
  };
};

export default useSpeechRecognitionKit;