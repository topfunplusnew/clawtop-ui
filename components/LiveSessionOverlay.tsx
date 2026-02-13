
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';

interface LiveSessionOverlayProps {
  onClose: (history: { role: 'user' | 'model'; text: string }[]) => void;
  isOpen: boolean;
}

const LiveSessionOverlay: React.FC<LiveSessionOverlayProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'closing'>('connecting');
  const [transcriptions, setTranscriptions] = useState<{ role: string; text: string }[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptionBufferRef = useRef({ user: '', model: '' });

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

    const startSession = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextsRef.current = { input: inputCtx, output: outputCtx };

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              if (!isMounted) return;
              setStatus('active');
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!isMounted) return;

              // Handle Transcriptions
              if (message.serverContent?.outputTranscription) {
                transcriptionBufferRef.current.model += message.serverContent.outputTranscription.text;
                setTranscriptions(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'model') {
                        return [...prev.slice(0, -1), { role: 'model', text: transcriptionBufferRef.current.model }];
                    }
                    return [...prev, { role: 'model', text: message.serverContent!.outputTranscription!.text }];
                });
              } else if (message.serverContent?.inputTranscription) {
                transcriptionBufferRef.current.user += message.serverContent.inputTranscription.text;
                setTranscriptions(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'user') {
                        return [...prev.slice(0, -1), { role: 'user', text: transcriptionBufferRef.current.user }];
                    }
                    return [...prev, { role: 'user', text: message.serverContent!.inputTranscription!.text }];
                });
              }

              if (message.serverContent?.turnComplete) {
                transcriptionBufferRef.current = { user: '', model: '' };
              }

              // Handle Audio
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio) {
                setIsAiSpeaking(true);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setIsAiSpeaking(false);
                });
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              }

              if (message.serverContent?.interrupted) {
                for (const s of sourcesRef.current.values()) {
                  s.stop();
                }
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsAiSpeaking(false);
              }
            },
            onclose: () => setStatus('closing'),
            onerror: () => setStatus('closing'),
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction: 'You are Super Slash AI. Keep your spoken responses concise, natural, and friendly. You are engaging in a real-time conversation.',
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        });

        sessionRef.current = await sessionPromise;
      } catch (err) {
        console.error('Failed to start live session:', err);
        onClose([]);
      }
    };

    startSession();

    return () => {
      isMounted = false;
      if (sessionRef.current) sessionRef.current.close();
      if (audioContextsRef.current) {
        audioContextsRef.current.input.close();
        audioContextsRef.current.output.close();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 bg-black/90 backdrop-blur-2xl transition-all animate-in fade-in zoom-in duration-300">
      <div className="w-full flex justify-between items-center text-white/60">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs font-medium uppercase tracking-widest">{status === 'active' ? 'Live Session' : 'Connecting...'}</span>
        </div>
        <button onClick={() => onClose(transcriptions as any)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="flex flex-col items-center justify-center space-y-12">
        <div className="relative">
          {/* Animated Glowing Orbs */}
          <div className={`absolute inset-0 bg-blue-500/20 rounded-full blur-3xl transition-transform duration-500 scale-[2] ${isAiSpeaking ? 'animate-pulse' : ''}`} />
          <div className={`w-32 h-32 rounded-full border-4 border-white/20 flex items-center justify-center relative z-10 transition-all duration-300 ${isAiSpeaking ? 'scale-110 bg-white/5 border-white/40' : 'bg-white/0'}`}>
             <div className={`w-12 h-12 bg-white rounded-full transition-all duration-500 ${isAiSpeaking ? 'scale-75 blur-sm opacity-50' : 'scale-100 opacity-100'}`} />
             {isAiSpeaking && (
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-full h-1 bg-white/40 rounded-full animate-pulse rotate-45" />
                 <div className="w-full h-1 bg-white/40 rounded-full animate-pulse -rotate-45" />
               </div>
             )}
          </div>
        </div>
        <h2 className="text-2xl font-light text-white tracking-tight">
          {isAiSpeaking ? 'Listening to Slash...' : 'Speak now...'}
        </h2>
      </div>

      <div className="w-full max-w-md h-40 overflow-y-auto custom-scrollbar flex flex-col-reverse space-y-reverse space-y-4 px-4 pb-4">
        {[...transcriptions].reverse().map((t, i) => (
          <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${t.role === 'user' ? 'bg-blue-600/40 text-blue-50' : 'bg-white/10 text-white/80'}`}>
              {t.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveSessionOverlay;
