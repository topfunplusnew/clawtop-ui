
import React from 'react';
import { Message, Role } from '../types';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
        {!isUser && (
          <div className="flex-shrink-0 mb-5 mr-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
               <i className="fa-solid fa-robot text-xs"></i>
            </div>
          </div>
        )}
        
        <div className="flex flex-col">
          <div
            className={`px-4 py-3 rounded-2xl text-sm md:text-base shadow-sm relative ${
              isUser
                ? 'bg-blue-600 text-white rounded-br-none ml-2'
                : 'bg-gray-100 text-gray-800 rounded-bl-none mr-2'
            }`}
          >
            {message.isLive && (
              <span className={`absolute -top-5 ${isUser ? 'right-0' : 'left-0'} text-[8px] font-bold uppercase tracking-widest text-blue-500`}>
                <i className="fa-solid fa-waveform mr-1"></i> Live Session
              </span>
            )}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 space-y-2">
                {message.attachments.map((att, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden border border-white/20">
                    {att.type === 'image' ? (
                      <img src={att.url} alt="Attachment" className="max-w-full h-auto block" />
                    ) : (
                      <div className="flex items-center p-2 bg-black/10 text-xs md:text-sm">
                        <i className="fa-solid fa-file-lines mr-2"></i>
                        <span className="truncate">{att.name || 'File attachment'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap leading-relaxed">
              {message.text || (message.isStreaming ? '...' : '')}
            </div>
          </div>
          <span className={`text-[10px] mt-1 text-gray-400 font-medium ${isUser ? 'text-right pr-1' : 'text-left pl-1'}`}>
            {message.timestamp}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
