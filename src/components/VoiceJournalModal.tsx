import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Square, 
  Check, 
  Trash2, 
  RotateCcw, 
  Sparkles, 
  AlertCircle, 
  X, 
  Volume2, 
  Radio, 
  Loader2,
  FileText
} from 'lucide-react';
import { getCurrentUserIdToken } from '../lib/firebase';

interface VoiceJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTranscript: (transcript: string, autoReflect?: boolean) => void;
}

// Browser Web Speech API type augmentation
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export const VoiceJournalModal: React.FC<VoiceJournalModalProps> = ({
  isOpen,
  onClose,
  onApplyTranscript,
}) => {
  // States: 'idle' | 'recording' | 'processing' | 'review'
  const [stage, setStage] = useState<'idle' | 'recording' | 'processing' | 'review'>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [useServerFallback, setUseServerFallback] = useState(false);

  // References
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check Web Speech API availability
  const isWebSpeechSupported = typeof window !== 'undefined' && 
    (Boolean(window.SpeechRecognition) || Boolean(window.webkitSpeechRecognition));

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      resetState();
    } else {
      cleanupResources();
    }
    return () => {
      cleanupResources();
    };
  }, [isOpen]);

  const resetState = () => {
    cleanupResources();
    setStage('idle');
    setTranscript('');
    setInterimText('');
    setElapsedSeconds(0);
    setErrorMessage(null);
    setAudioLevel(0);
  };

  const cleanupResources = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
  };

  /**
   * Start recording audio & transcription
   */
  const handleStartRecording = async () => {
    resetState();
    setErrorMessage(null);

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Set up Audio Analyzer for visual feedback
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(updateLevel);
            }
          };
          updateLevel();
        }
      } catch (audioErr) {
        console.warn('AudioContext visualizer notice (non-fatal):', audioErr);
      }

      // 3. Start MediaRecorder (for backup / server-side transcription)
      audioChunksRef.current = [];
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
        
        const mediaRecorder = mimeType 
          ? new MediaRecorder(stream, { mimeType }) 
          : new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(250); // collect 250ms chunks
      } catch (recErr) {
        console.warn('MediaRecorder notice:', recErr);
      }

      // 4. Initialize Web Speech API if supported
      let accumulatedTranscript = '';
      if (isWebSpeechSupported && !useServerFallback) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptChunk = result[0].transcript;
            if (result.isFinal) {
              accumulatedTranscript += (accumulatedTranscript ? ' ' : '') + transcriptChunk.trim();
              setTranscript(accumulatedTranscript);
            } else {
              currentInterim += transcriptChunk;
            }
          }
          setInterimText(currentInterim);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error event:', event.error);
          if (event.error === 'no-speech') {
            // User paused speaking; keep going
            return;
          }
          if (event.error === 'not-allowed') {
            setErrorMessage('Microphone access denied. Please enable microphone permissions in your browser.');
            handleStopRecording();
          }
        };

        recognition.onend = () => {
          // If still recording stage, restart continuous recognition
          if (stage === 'recording' && recognitionRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      // 5. Start elapsed timer
      setElapsedSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      setStage('recording');
    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access to use voice journaling.'
          : `Could not initialize audio recording: ${err.message || 'Unknown error'}`
      );
      setStage('idle');
    }
  };

  /**
   * Stop recording and transition to Review stage (or server transcription)
   */
  const handleStopRecording = async () => {
    if (stage !== 'recording') return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    // Stop tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Check if we captured speech via Web Speech API
    const finalBrowserText = (transcript + (interimText ? ' ' + interimText : '')).trim();
    setInterimText('');

    if (finalBrowserText && !useServerFallback) {
      // Direct transition to Review mode
      setTranscript(finalBrowserText);
      setStage('review');
    } else {
      // If Web Speech API wasn't available or returned empty, attempt server-side Gemini transcription
      setStage('processing');
      await performServerTranscription();
    }
  };

  /**
   * Fallback: Convert recorded audio blob to base64 and transcribe via Gemini backend
   */
  const performServerTranscription = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current) return resolve();
          mediaRecorderRef.current.onstop = () => resolve();
          mediaRecorderRef.current.stop();
        });
      }

      const audioBlob = new Blob(audioChunksRef.current, {
        type: audioChunksRef.current[0]?.type || 'audio/webm',
      });

      if (audioBlob.size < 100) {
        setErrorMessage('No audio was captured. Please speak clearly into your microphone.');
        setStage('idle');
        return;
      }

      // Convert Blob to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('User authentication token not found. Please sign in again.');
      }

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to transcribe audio.');
      }

      if (data.transcript && data.transcript.trim()) {
        setTranscript(data.transcript.trim());
        setStage('review');
      } else {
        setErrorMessage('No intelligible speech was recognized. You can try speaking again.');
        setStage('idle');
      }
    } catch (err: any) {
      console.error('Server transcription error:', err);
      setErrorMessage(err.message || 'Transcription failed. Please try again.');
      setStage('idle');
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  if (!isOpen) return null;

  return (
    <div 
      id="voice-journal-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      <div 
        id="voice-journal-modal-card"
        className="w-full max-w-2xl bg-[#fcfbf7] border border-[#e0ddd5] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="h-16 px-6 sm:px-8 border-b border-[#e0ddd5] flex items-center justify-between bg-[#f8f6f0]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#4a5d4e]/10 text-[#4a5d4e] flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif italic text-lg sm:text-xl text-[#1a1a1a] leading-none">
                Voice Journaling
              </h2>
              <p className="text-[10px] uppercase tracking-[1.5px] text-[#8e8a82] font-semibold mt-1">
                Speak your reflections naturally
              </p>
            </div>
          </div>

          <button
            id="btn-close-voice-modal"
            type="button"
            onClick={onClose}
            className="p-2 text-[#8e8a82] hover:text-[#1a1a1a] hover:bg-stone-200/50 rounded-full transition-colors cursor-pointer"
            title="Close Voice Journal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 sm:mx-8 mt-4 p-3.5 border border-[#c44536]/30 bg-[#c44536]/5 text-[#c44536] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-[#c44536] font-semibold underline text-[11px] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto flex flex-col">
          {/* Stage 1: Idle (Ready to record) */}
          {stage === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-6">
              <div className="relative">
                <button
                  id="btn-start-recording"
                  type="button"
                  onClick={handleStartRecording}
                  className="w-24 h-24 rounded-full bg-[#4a5d4e] hover:bg-[#3d4d40] text-white flex flex-col items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer group"
                >
                  <Mic className="w-9 h-9 transition-transform group-hover:scale-110" />
                  <span className="text-[10px] uppercase tracking-wider font-bold mt-1">Record</span>
                </button>
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="font-serif italic text-xl text-[#1a1a1a]">
                  "Speak your mind freely"
                </h3>
                <p className="text-xs text-[#8e8a82] leading-relaxed">
                  Your spoken words will be converted to text in real-time. You can review and edit your transcript before deciding to save or reflect.
                </p>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-[#8e8a82] pt-4 border-t border-[#e0ddd5] w-full justify-center">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-[#4a5d4e]" />
                  <span>Private In-Memory Audio</span>
                </span>
                <span>•</span>
                <span>No Raw Audio Persisted</span>
              </div>
            </div>
          )}

          {/* Stage 2: Recording in progress */}
          {stage === 'recording' && (
            <div className="flex-1 flex flex-col items-center justify-between py-4 space-y-6">
              {/* Status & Timer Indicator */}
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                  <span className="w-2 h-2 rounded-full bg-red-600 absolute" />
                  <span className="ml-1 uppercase tracking-wider text-[11px]">Recording in progress</span>
                </div>

                <div 
                  id="voice-elapsed-time"
                  className="font-mono text-3xl sm:text-4xl text-[#1a1a1a] font-bold tracking-wider pt-2"
                >
                  {formatTime(elapsedSeconds)}
                </div>
              </div>

              {/* Dynamic Sound Level Bar Visualizer */}
              <div className="w-full max-w-sm flex items-center justify-center gap-1.5 h-12 px-4 py-2 bg-[#f8f6f0] border border-[#e0ddd5]">
                {[...Array(16)].map((_, i) => {
                  const barHeight = Math.max(
                    15,
                    Math.min(100, (audioLevel * (1 + Math.sin(i + elapsedSeconds * 4) * 0.4)))
                  );
                  return (
                    <div
                      key={i}
                      className="w-1.5 bg-[#4a5d4e] transition-all duration-75 rounded-xs"
                      style={{ height: `${barHeight}%` }}
                    />
                  );
                })}
              </div>

              {/* Live Streaming Speech Preview */}
              <div className="w-full bg-white border border-[#e0ddd5] p-4 min-h-[120px] max-h-[160px] overflow-y-auto text-left shadow-inner">
                <span className="text-[10px] uppercase tracking-[1.5px] text-[#8e8a82] font-semibold block mb-2">
                  Live Listening Stream:
                </span>
                <p className="font-serif italic text-sm text-[#333] leading-relaxed">
                  {transcript ? transcript : ''}
                  {interimText && (
                    <span className="text-[#8e8a82] font-normal"> {interimText}...</span>
                  )}
                  {!transcript && !interimText && (
                    <span className="text-stone-400 font-sans text-xs italic">
                      Listening... Speak into your microphone...
                    </span>
                  )}
                </p>
              </div>

              {/* Stop Recording Control */}
              <button
                id="btn-stop-recording"
                type="button"
                onClick={handleStopRecording}
                className="px-8 py-3.5 bg-[#c44536] hover:bg-[#a83629] active:bg-[#8e2d22] text-white rounded-none shadow-md text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2.5 cursor-pointer hover:scale-102"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Recording</span>
              </button>
            </div>
          )}

          {/* Stage 3: Processing / Transcribing Fallback */}
          {stage === 'processing' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-4">
              <Loader2 className="w-10 h-10 text-[#4a5d4e] animate-spin" />
              <div className="space-y-1">
                <h3 className="font-serif italic text-xl text-[#1a1a1a]">
                  Transcribing with Gemini...
                </h3>
                <p className="text-xs text-[#8e8a82]">
                  Accurately converting your spoken voice into natural journal text.
                </p>
              </div>
            </div>
          )}

          {/* Stage 4: Review & Edit Transcript */}
          {stage === 'review' && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-[#e0ddd5] pb-2">
                <div>
                  <h3 
                    id="transcript-review-heading"
                    className="font-serif italic text-lg sm:text-xl text-[#1a1a1a]"
                  >
                    Your transcription
                  </h3>
                  <span className="text-[11px] text-[#8e8a82]">
                    Review and edit your text below before saving to your journal.
                  </span>
                </div>
                <span className="text-xs font-mono text-[#8e8a82] uppercase">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
              </div>

              {/* Editable Transcription Textarea */}
              <div className="flex-1 flex flex-col min-h-[160px]">
                <textarea
                  id="voice-transcript-editor"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your speech transcript will appear here. You can freely edit or expand it..."
                  rows={7}
                  className="w-full flex-1 p-4 bg-white border border-[#e0ddd5] font-serif text-sm sm:text-base leading-[1.8] text-[#222] outline-none focus:border-[#4a5d4e] transition-colors resize-none shadow-inner"
                />
              </div>

              {/* Review Actions Row */}
              <div className="pt-4 border-t border-[#e0ddd5] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    id="btn-discard-transcript"
                    type="button"
                    onClick={() => {
                      resetState();
                      onClose();
                    }}
                    className="px-4 py-2 border border-[#e0ddd5] bg-white text-[#8e8a82] hover:text-[#c44536] hover:border-[#c44536]/40 text-xs uppercase tracking-wider font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Discard</span>
                  </button>

                  <button
                    id="btn-record-again"
                    type="button"
                    onClick={() => {
                      resetState();
                      handleStartRecording();
                    }}
                    className="px-4 py-2 border border-[#e0ddd5] bg-white text-[#1a1a1a] hover:bg-[#f8f6f0] text-xs uppercase tracking-wider font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Record Again</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    id="btn-save-entry-transcript"
                    type="button"
                    disabled={!transcript.trim()}
                    onClick={() => {
                      onApplyTranscript(transcript.trim(), false);
                      onClose();
                    }}
                    className="px-5 py-2.5 bg-[#4a5d4e] hover:bg-[#3d4d40] text-white text-xs uppercase tracking-wider font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Entry</span>
                  </button>

                  <button
                    id="btn-reflect-transcript"
                    type="button"
                    disabled={!transcript.trim()}
                    onClick={() => {
                      onApplyTranscript(transcript.trim(), true);
                      onClose();
                    }}
                    className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#333] text-white text-xs uppercase tracking-wider font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#e0ddd5]" />
                    <span>Reflect with Gemini</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
