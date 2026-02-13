
import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';

interface ChatInputProps {
  onSendMessage: (text: string, attachments?: any[]) => void;
  disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [showConfirmPanel, setShowConfirmPanel] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleSend = (textToSend = input) => {
    if ((textToSend.trim() || attachments.length > 0) && !disabled) {
      onSendMessage(textToSend, attachments);
      setInput('');
      setTranscribedText('');
      setShowConfirmPanel(false);
      setAttachments([]);
      setIsVoiceMode(false);
      setIsMenuOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      const base64 = data.split(',')[1];
      setAttachments(prev => [...prev, {
        type,
        url: data,
        data: base64,
        mimeType: file.type,
        name: file.name
      }]);
    };
    reader.readAsDataURL(file);
    setIsMenuOpen(false); // Close menu after selection
    e.target.value = '';
  };

  const handleLocationClick = () => {
    if (!navigator.geolocation) {
      alert("您的浏览器不支持地理位置服务");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationText = `📍 我当前的位置：北纬 ${latitude.toFixed(4)}, 东经 ${longitude.toFixed(4)}。请帮我看看这附近有什么好玩的？`;
        onSendMessage(locationText);
        setIsLocating(false);
        setIsMenuOpen(false);
      },
      (error) => {
        console.error("Location error:", error);
        alert("无法获取您的位置，请检查权限设置");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setShowConfirmPanel(false);
      setTranscribedText('');
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowConfirmPanel(true);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const text = await transcribeAudio(base64, 'audio/webm');
        setTranscribedText(text);
        setInput(text); 
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Transcription failed", err);
      setTranscribedText("识别失败，请重试");
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    if (isVoiceMode) setIsVoiceMode(false);
  };

  return (
    <div className="bg-white p-4 border-t border-gray-100 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 relative z-30">
      <div className="max-w-4xl mx-auto">
        {showConfirmPanel && (
          <div className="absolute left-4 right-4 bottom-full mb-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-white/80 backdrop-blur-xl border border-blue-100 rounded-3xl p-5 shadow-xl overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">语音识别</span>
                </div>
                {isTranscribing && (
                   <i className="fa-solid fa-circle-notch fa-spin text-blue-400 text-xs"></i>
                )}
              </div>
              
              <div className="min-h-[60px] flex flex-col justify-center">
                {isTranscribing ? (
                  <div className="space-y-2">
                    <div className="h-4 w-full shimmer-bg rounded-full"></div>
                    <div className="h-4 w-4/5 shimmer-bg rounded-full opacity-60"></div>
                  </div>
                ) : (
                  <p className="text-gray-800 text-base font-medium leading-relaxed italic animate-in fade-in slide-in-from-left-2">
                    "{transcribedText || "未检测到内容"}"
                  </p>
                )}
              </div>

              <div className="flex space-x-3 mt-5">
                <button 
                  onClick={() => handleSend(transcribedText)}
                  disabled={isTranscribing || !transcribedText}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center space-x-2"
                >
                  <i className="fa-solid fa-check"></i>
                  <span>确认发送</span>
                </button>
                <button 
                  onClick={() => { setShowConfirmPanel(false); setTranscribedText(''); setInput(''); }}
                  className="px-6 py-3 bg-gray-100 text-gray-500 text-sm font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative group">
                {att.type === 'image' ? (
                  <img src={att.url} className="w-16 h-16 object-cover rounded-2xl border border-gray-100" />
                ) : (
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
                    <i className="fa-solid fa-file text-gray-400"></i>
                  </div>
                )}
                <button 
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => { setIsVoiceMode(!isVoiceMode); setShowConfirmPanel(false); setIsMenuOpen(false); }}
            className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${isVoiceMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
          >
            <i className={`fa-solid ${isVoiceMode ? 'fa-keyboard' : 'fa-microphone-lines'} text-lg`}></i>
          </button>
          
          <div className="flex-grow relative h-11">
            {!isVoiceMode ? (
              <div className="h-full w-full flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="说点什么吧..."
                  disabled={disabled}
                  className="w-full h-full px-5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all placeholder:text-gray-400"
                />
                <button 
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && attachments.length === 0) || disabled}
                  className={`absolute right-1.5 top-1.5 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    input.trim() || attachments.length > 0 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-gray-300'
                  }`}
                >
                  <i className="fa-solid fa-arrow-up text-sm"></i>
                </button>
              </div>
            ) : (
              <div className="relative h-full w-full">
                {isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-11 h-11 bg-red-500/20 rounded-full animate-wave"></div>
                    <div className="w-11 h-11 bg-red-500/20 rounded-full animate-wave-delayed"></div>
                  </div>
                )}
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                  disabled={disabled || isTranscribing}
                  className={`w-full h-full rounded-full font-bold text-sm transition-all flex items-center justify-center space-x-2 relative z-10 ${
                    isRecording 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-200 active:scale-95' 
                      : 'bg-gray-900 text-white hover:bg-black active:scale-[0.98]'
                  } disabled:opacity-50`}
                >
                  {isRecording ? (
                    <>
                      <div className="flex space-x-1 items-center">
                        <div className="w-1 h-3 bg-white/60 rounded-full animate-bounce"></div>
                        <div className="w-1 h-5 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1 h-3 bg-white/60 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                      <span className="tracking-wide">松开 结束</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-microphone text-blue-400"></i>
                      <span>按住 说话</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={toggleMenu}
            className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${isMenuOpen ? 'bg-gray-200 text-gray-800 rotate-45' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
          >
            <i className="fa-solid fa-plus text-lg"></i>
          </button>
        </div>

        {isMenuOpen && !isVoiceMode && (
          <div className="flex items-center justify-between mt-5 px-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <button 
              onClick={() => imageInputRef.current?.click()}
              className="group flex flex-col items-center space-y-2 text-gray-400 hover:text-blue-600 transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 group-hover:bg-blue-50 group-hover:scale-110 transition-all">
                <i className="fa-solid fa-image text-lg"></i>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">相册</span>
            </button>
            <input type="file" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} accept="image/*" className="hidden" />

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="group flex flex-col items-center space-y-2 text-gray-400 hover:text-blue-600 transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 group-hover:bg-blue-50 group-hover:scale-110 transition-all">
                <i className="fa-solid fa-folder-open text-lg"></i>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">文件</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'file')} className="hidden" />

            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="group flex flex-col items-center space-y-2 text-gray-400 hover:text-blue-600 transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 group-hover:bg-blue-50 group-hover:scale-110 transition-all">
                <i className="fa-solid fa-camera text-lg"></i>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">相机</span>
            </button>
            <input type="file" ref={cameraInputRef} onChange={(e) => handleFileChange(e, 'image')} accept="image/*" capture="environment" className="hidden" />
            
            <button 
              onClick={handleLocationClick}
              disabled={isLocating}
              className={`group flex flex-col items-center space-y-2 transition-all ${isLocating ? 'text-blue-400' : 'text-gray-400 hover:text-blue-600'}`}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 group-hover:bg-blue-50 group-hover:scale-110 transition-all ${isLocating ? 'animate-pulse bg-blue-50' : ''}`}>
                <i className={`fa-solid ${isLocating ? 'fa-spinner fa-spin' : 'fa-location-dot'} text-lg`}></i>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{isLocating ? '获取中' : '位置'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
