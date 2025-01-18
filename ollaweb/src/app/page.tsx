'use client'

import { useChat } from 'ai/react'
import { useState } from 'react'

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat()
  const [isTyping, setIsTyping] = useState(false)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsTyping(true)
    try {
      await handleSubmit(e)
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="container flex items-center h-14 px-4">
          <h1 className="text-lg font-semibold">Ollama Assistant</h1>
        </div>
      </header>

      {/* Chat Container */}
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
                    {m.content}
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

      {/* Input Form */}
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
              disabled={isTyping}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

