"use client";

import { useState, useCallback, useRef, useEffect } from "react"; // Added useEffect
import { useChat } from "ai/react";
import { InstallDialog } from "./components/install-dialog";
import { CodeBlock } from "./components/code-block";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function Chat() {
  // Add a ref for the file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [model, setModel] = useState("llama3.2-vision");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [isResponding, setIsResponding] = useState(false);

  const { 
    messages, 
    input, 
    handleInputChange, 
    setMessages,
    setInput,
    isLoading: isTyping 
  } = useChat({
    api: "/api/chat",
    body: { model }
  });

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsResponding(true);
    
    const formData = new FormData();
    if (imageFile) formData.append("image", imageFile);
    
    // Create a new messages array that includes the pending message
    const newMessages = [
      ...messages,
      { role: 'user', content: input, image: imageFile ? URL.createObjectURL(imageFile) : undefined }
    ];
    
    formData.append("messages", JSON.stringify(newMessages));
    formData.append("model", model);
  
    try {
      // Clear inputs immediately
      setInput("");
      setImageFile(null);
      setImagePreview(null);
  
      // Add user message to history
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'user',
        content: input,
        image: imageFile ? URL.createObjectURL(imageFile) : undefined
      }]);
  
      // Generate unique ID for the assistant response
      const assistantMessageId = Date.now().toString() + '-assistant';
      
      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData
      });
  
      const reader = response.body?.getReader();
      if (!reader) return;
  
      const decoder = new TextDecoder();
      let done = false;
      let responseText = "";
  
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        responseText += decoder.decode(value || new Uint8Array());
        
        // Update or create assistant message
        setMessages(prev => {
          const existingMessageIndex = prev.findIndex(msg => msg.id === assistantMessageId);
          
          if (existingMessageIndex !== -1) {
            // Update existing assistant message
            const updated = [...prev];
            updated[existingMessageIndex] = {
              ...updated[existingMessageIndex],
              content: responseText
            };
            return updated;
          }
          
          // Add new assistant message
          return [...prev, {
            id: assistantMessageId,
            role: 'assistant',
            content: responseText
          }];
        });
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Chat error:", error);
      // Remove temporary message on error
      setMessages(prev => prev.filter(msg => !msg.id.endsWith('-assistant')));
    } finally {
      setIsResponding(false);
    }
  }, [imageFile, messages, input, model, setMessages, setInput]);

  useEffect(() => {
    const handleModelInstallation = async () => {
      try {
        setIsInstalling(true);
        setInstallMessage(`Checking ${model} installation...`);
        
        // Check model installation status
        const checkResponse = await fetch(`/api/check-model?model=${model}`);
        if (!checkResponse.ok) throw new Error('Check failed');
        
        const { installed } = await checkResponse.json();
        
        if (!installed) {
          setInstallMessage(`Downloading ${model}...`);
          
          // Start model installation
          const installResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, installOnly: true })
          });

          if (!installResponse.body) return;
          
          const reader = installResponse.body.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            setInstallMessage(prev => `${prev}\n${chunk}`);
          }
        }
      } catch (error) {
        console.error('Installation error:', error);
        setInstallMessage(`Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsInstalling(false);
      }
    };

    handleModelInstallation();
  }, [model]); // Trigger when model changes

  const renderMessageContent = (content: string) => {
    return content.split(/(```[\s\S]*?```|<think>[\s\S]*?<\/think>)/g).map((part, index) => {
      if (part.startsWith("```")) {
        const match = part.match(/```(\w+)?\n([\s\S]+?)```/);
        return match ? (
          <CodeBlock 
            key={index} 
            code={match[2].trim()} 
            language={match[1] || 'text'} 
          />
        ) : part;
      }
      if (part.trim().startsWith("<think>")) {
        const trimmed = part.trim();
        const thinkContent = trimmed.slice(7, -8);
        if(thinkContent.length == 2){
          return null;
        }
        return (
          <div key={index} className="bg-gray-100 p-2 italic text-gray-600">
            {"Thinking: " +  thinkContent}
          </div>
        );
      }
      return part.split('**').map((text, i) => 
        i % 2 ? <strong key={`${index}-${i}`}>{text}</strong> : text
      );
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <InstallDialog isOpen={isInstalling} message={installMessage} />
      
      <header className="sticky top-0 bg-white border-b z-10 shadow-sm">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-semibold text-xl text-gray-800 custom-header">OllaWeb</h1>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-3 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="llama3.2">Llama 3.2 (2B|2GB) 💬</option>
            <option value="mistral">Mistral (7B|4.1GB) 💬</option>
            <option value="qwq">QwQ (32B|20GB) 💬</option>
            <option value="deepseek-r1:7b">Deepseek-R1 7B (7B|4.7GB) 💬</option>
            <option value="deepseek-r1:32b">Deepseek-R1 32B (32B|20GB) 💬</option>
            <option value="llava-llama3">Llava-llama3 (8B|5.5GB) 💬👁️ </option>
            <option value="llama3.2-vision">Llama 3.2 Vision (11B|7.9GB) 💬👁️ </option>
          </select>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`p-3 rounded-lg max-w-[85%] ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-900 shadow-sm'
              }`}>
                <div className="prose">
                  {renderMessageContent(message.content)}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
            </div>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 bg-white border-t shadow-sm">
        <div className="max-w-4xl mx-auto p-4">
          {imagePreview && (
            <div className="flex justify-center mb-2">
              <img 
                src={imagePreview} 
                alt="Uploaded content" 
                className="w-20 h-auto rounded"
              />
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={model !== 'llama3.2-vision' && model !== 'llava-llama3'}
              ref={fileInputRef}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={model !== 'llama3.2-vision' && model !== 'llava-llama3'}
              className={`px-4 py-2 rounded-lg flex items-center justify-center ${
                model === 'llama3.2-vision' || model === 'llava-llama3'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 cursor-not-allowed'
              }`}
            >
              📎
            </button>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isTyping || isResponding}
              className="w-14 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
            >
              Send
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
