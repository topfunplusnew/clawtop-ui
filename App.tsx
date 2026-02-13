
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import LiveSessionOverlay from './components/LiveSessionOverlay';
import { Message, Role, Attachment } from './types';
import { sendMessageToGemini, analyzeImage } from './services/geminiService';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: Role.MODEL,
      text: "你好！我是超级斜杠AI。有什么我可以帮你的吗？",
      timestamp: "10:30 AM"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string, attachments?: Attachment[]) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text,
      timestamp,
      attachments
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsTyping(true);

    try {
      if (attachments && attachments.length > 0 && attachments[0].type === 'image') {
        const imageData = attachments[0].data || "";
        const mimeType = attachments[0].mimeType;
        const result = await analyzeImage(imageData, mimeType, text || "Describe this image");
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: Role.MODEL,
          text: result || "I've processed the data.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const streamingMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, {
          id: streamingMessageId,
          role: Role.MODEL,
          text: "",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isStreaming: true
        }]);

        await sendMessageToGemini([...messages, newUserMessage], (chunkText) => {
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId ? { ...msg, text: chunkText } : msg
          ));
        });

        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg
        ));
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: Role.MODEL,
        text: "抱歉，出了一点问题。请稍后再试。",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCloseLive = (history: { role: string; text: string }[]) => {
    setIsLiveMode(false);
    if (history.length > 0) {
      const newMessages: Message[] = history.map((h, i) => ({
        id: `live-${Date.now()}-${i}`,
        role: h.role === 'user' ? Role.USER : Role.MODEL,
        text: h.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isLive: true
      }));
      setMessages(prev => [...prev, ...newMessages]);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-white shadow-2xl relative overflow-hidden md:rounded-[3rem] md:my-8 md:h-[calc(100vh-4rem)]">
      <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-white rounded-b-3xl z-20"></div>
      
      <Header />
      
      <main className="flex-grow overflow-y-auto custom-scrollbar px-4 pt-4 pb-2 bg-gradient-to-b from-gray-50/50 to-white">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && !messages.some(m => m.isStreaming) && (
          <div className="flex justify-start mb-6">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-none flex space-x-1 items-center">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <ChatInput 
        onSendMessage={handleSendMessage} 
        disabled={isTyping} 
      />

      <LiveSessionOverlay 
        isOpen={isLiveMode} 
        onClose={handleCloseLive} 
      />
    </div>
  );
};

export default App;
