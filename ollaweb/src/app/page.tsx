// App.tsx
"use client";

import { useState } from 'react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { MainContainer, ChatContainer, MessageList, Message, MessageInput, TypingIndicator } from '@chatscope/chat-ui-kit-react';
import { Ollama } from 'ollama';

const ollama = new Ollama({host: 'http://localhost:11434'}); // Adjust if your Ollama API is hosted elsewhere

interface ChatMessage {
  message: string;
  sender: "user" | "assistant";
}

const systemMessage = {
  role: "system",
  content: "Explain things like you're talking to a software professional with 2 years of experience."
};

function App() {
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSend = async (message: string) => {
    const newMessage = {
      message,
      sender: "user" as const
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setIsTyping(true);

    try {
      const response = await ollama.chat({
        model: 'llama3.1',
        messages: [systemMessage,
        ...messages, {role:'user', content: message}],
      })

      if (!response.ok) {
        throw new Error('Failed to get response from Ollama');
      }

      const data = response;
      
      const assistantMessage: ChatMessage = {
        message: data.message.content,
        sender: "assistant"
      };

      setMessages(prevMessages => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      // Add error handling UI if needed
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="App">
      <div style={{ position: "relative", height: "800px", width: "700px" }}>
        <MainContainer>
          <ChatContainer>
            <MessageList
              scrollBehavior="smooth"
              typingIndicator={isTyping ? <TypingIndicator content="AI is typing" /> : null}
            >
              {messages.map((message, i) => (
                <Message key={i} model={{
                  message: message.message,
                  sender: message.sender,
                  direction: message.sender === 'user' ? 'outgoing' : 'incoming',
                  position: 'single'
                }} />
              ))}
            </MessageList>
            <MessageInput placeholder="Type message here" onSend={handleSend} />
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}

export default App;