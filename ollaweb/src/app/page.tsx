'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useChat } from 'ai/react';
import { InstallDialog } from './components/install-dialog';

export default function Chat() {
  const [model, setModel] = useState('llama3.2');
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    body: { model },
  });
  const [isTyping, setIsTyping] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState('');

  useEffect(() => {
    console.log('isInstalling:', isInstalling);
  }, [isInstalling]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsTyping(true);
    try {
      await handleSubmit(e);
    } catch (error) {
      console.error('Error submitting message:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const showPopup = useCallback((message: string) => {
    alert(message);
  }, []);

  const installModel = useCallback(async (model: string) => {
    setIsInstalling(true);
    setInstallMessage(`Installing model ${model}...`);
    try {
      const response = await fetch(`/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: [], model }),
      });

      if (!response.body) {
        setInstallMessage(`No response body received for model ${model}.`);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        setInstallMessage(prev => prev + decoder.decode(value));
      }
    } catch (error) {
      console.error('Error installing model:', error);
      showPopup(`Error installing model: ${model}`);
    } finally {
      setIsInstalling(false);
    }
  }, [showPopup]);

  const handleModelChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setModel(newModel);
    showPopup(`Model changed to ${newModel}`);

    try {
      // Check if model is installed
      const checkResponse = await fetch(`/api/check-model?model=${encodeURIComponent(newModel)}`);
      if (!checkResponse.ok) {
        console.error(`Failed to check model ${newModel}`);
        return;
      }
      const result = await checkResponse.json();
      // If not installed, install it
      if (!result.installed) {
        await installModel(newModel);
      }
    } catch (error) {
      console.error(`Failed to check/install model ${newModel}:`, error);
    }
  }, [installModel, showPopup]);

  console.log('Render InstallDialog:', isInstalling ? 'Yes' : 'No');

  return (
    <div className="flex flex-col min-h-screen bg-white relative">
      <InstallDialog isOpen={isInstalling} message={installMessage} />
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="container flex items-center justify-between h-14 px-4">
          <h1 className="text-lg font-semibold">OllaWeb</h1>
          <select
            value={model}
            onChange={handleModelChange}
            className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="llama3.2">Llama 3.2 (2B|2GB)</option>
            <option value="qwq">QwQ (32B|20GB)</option>
            <option value="mistral">Mistral (7B|4.1GB)</option>
          </select>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="container flex-1 w-full max-w-4xl mx-auto px-4">
          <div className="space-y-4 py-4">
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    rounded-lg px-4 py-2 max-w-[85%] sm:max-w-[75%]
                    ${m.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                    }
                  `}
                >
                  <div className="prose prose-sm dark:prose-invert">
                    {m.content.split('**').map((part, index) =>
                      index % 2 === 1 ? <strong key={index}>{part}</strong> : part
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 border-t bg-white">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={onSubmit} className="flex space-x-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Message Ollama..."
              className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            <button 
              type="submit" 
              disabled={isTyping || isInstalling}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

