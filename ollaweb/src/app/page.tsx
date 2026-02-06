"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useChat } from "ai/react";
import { InstallDialog } from "./components/install-dialog";
import { CodeBlock } from "./components/code-block";
import { CouncilSelector } from "./components/council-selector";
import { CouncilResponse } from "./components/council-response";
import type { ChatMode, CouncilState, CouncilEvent, IndividualResponse } from "../lib/types";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  councilData?: IndividualResponse[];
};

export default function Chat() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [model, setModel] = useState("llama3.2-vision");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [isResponding, setIsResponding] = useState(false);

  // Council state
  const [chatMode, setChatMode] = useState<ChatMode>('single');
  const [councilModels, setCouncilModels] = useState<[string, string, string]>([
    'llama3.2', 'mistral', 'deepseek-r1:7b'
  ]);
  const [moderatorIndex, setModeratorIndex] = useState(0);
  const [councilState, setCouncilState] = useState<CouncilState>({
    phase: 'idle',
    individualResponses: [],
    consensusText: '',
    moderatorModel: '',
  });

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

  // Check if any selected model supports vision (for image upload button)
  const hasVisionModel = chatMode === 'single'
    ? (model === 'llama3.2-vision' || model === 'llava-llama3')
    : councilModels.some(m => m === 'llama3.2-vision' || m === 'llava-llama3');

  // Single AI submit handler (existing logic)
  const handleSingleSubmit = useCallback(async () => {
    setIsResponding(true);

    const formData = new FormData();
    if (imageFile) formData.append("image", imageFile);

    const newMessages = [
      ...messages,
      { role: 'user', content: input, image: imageFile ? URL.createObjectURL(imageFile) : undefined }
    ];

    formData.append("messages", JSON.stringify(newMessages));
    formData.append("model", model);

    try {
      setInput("");
      setImageFile(null);
      setImagePreview(null);

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'user',
        content: input,
        image: imageFile ? URL.createObjectURL(imageFile) : undefined
      }]);

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

        setMessages(prev => {
          const existingMessageIndex = prev.findIndex(msg => msg.id === assistantMessageId);

          if (existingMessageIndex !== -1) {
            const updated = [...prev];
            updated[existingMessageIndex] = {
              ...updated[existingMessageIndex],
              content: responseText
            };
            return updated;
          }

          return [...prev, {
            id: assistantMessageId,
            role: 'assistant',
            content: responseText
          }];
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => prev.filter(msg => !msg.id.endsWith('-assistant')));
    } finally {
      setIsResponding(false);
    }
  }, [imageFile, messages, input, model, setMessages, setInput]);

  // Council event dispatcher
  const dispatchCouncilEvent = useCallback((event: CouncilEvent) => {
    setCouncilState(prev => {
      switch (event.event) {
        case 'individual_start': {
          const updated = [...prev.individualResponses];
          updated[event.payload.index] = {
            ...updated[event.payload.index],
            status: 'streaming',
          };
          return { ...prev, individualResponses: updated };
        }
        case 'individual_chunk': {
          const updated = [...prev.individualResponses];
          updated[event.payload.index] = {
            ...updated[event.payload.index],
            text: updated[event.payload.index].text + event.payload.text,
          };
          return { ...prev, individualResponses: updated };
        }
        case 'individual_complete': {
          const updated = [...prev.individualResponses];
          updated[event.payload.index] = {
            ...updated[event.payload.index],
            text: event.payload.fullText,
            status: 'complete',
          };
          return { ...prev, individualResponses: updated };
        }
        case 'individual_error': {
          const updated = [...prev.individualResponses];
          updated[event.payload.index] = {
            ...updated[event.payload.index],
            status: 'error',
            error: event.payload.error,
          };
          return { ...prev, individualResponses: updated };
        }
        case 'synthesis_start':
          return { ...prev, phase: 'synthesizing', moderatorModel: event.payload.moderator };
        case 'synthesis_chunk':
          return { ...prev, consensusText: prev.consensusText + event.payload.text };
        case 'synthesis_complete':
          return { ...prev, phase: 'complete', consensusText: event.payload.fullText };
        case 'error':
          return { ...prev, phase: 'error' };
        default:
          return prev;
      }
    });
  }, []);

  // Council submit handler
  const handleCouncilSubmit = useCallback(async () => {
    setIsResponding(true);

    const initialResponses: IndividualResponse[] = councilModels.map((m, i) => ({
      model: m,
      index: i,
      text: '',
      status: 'pending' as const,
    }));

    setCouncilState({
      phase: 'individual',
      individualResponses: initialResponses,
      consensusText: '',
      moderatorModel: councilModels[moderatorIndex],
    });

    const currentInput = input;
    const currentImageFile = imageFile;

    setInput("");
    setImageFile(null);
    setImagePreview(null);

    // Add user message to history
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
    }]);

    const formData = new FormData();
    const newMessages = [
      ...messages,
      { role: 'user', content: currentInput }
    ];
    formData.append('messages', JSON.stringify(newMessages));
    formData.append('models', JSON.stringify(councilModels));
    formData.append('moderatorIndex', moderatorIndex.toString());
    if (currentImageFile) formData.append('image', currentImageFile);

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/council', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let finalCouncilState: { consensusText: string; individualResponses: IndividualResponse[] } | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: CouncilEvent = JSON.parse(line.slice(6));
            dispatchCouncilEvent(event);

            // Track final state for adding to messages
            if (event.event === 'synthesis_complete') {
              finalCouncilState = {
                consensusText: event.payload.fullText,
                individualResponses: [], // will be filled from state
              };
            }
          } catch {
            // Skip malformed events
          }
        }
      }

      // Add council response as an assistant message
      setCouncilState(prev => {
        if (prev.phase === 'complete' && prev.consensusText) {
          setMessages(msgs => [...msgs, {
            id: Date.now().toString() + '-council',
            role: 'assistant',
            content: prev.consensusText,
            councilData: prev.individualResponses,
          }]);
        }
        return { ...prev, phase: 'idle' };
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setCouncilState(prev => {
          // If we have partial data, still add it
          if (prev.consensusText) {
            setMessages(msgs => [...msgs, {
              id: Date.now().toString() + '-council',
              role: 'assistant',
              content: prev.consensusText + '\n\n*[Council deliberation was stopped]*',
              councilData: prev.individualResponses,
            }]);
          }
          return { ...prev, phase: 'idle' };
        });
      } else {
        console.error("Council error:", error);
        setCouncilState(prev => ({ ...prev, phase: 'error' }));
      }
    } finally {
      setIsResponding(false);
      abortControllerRef.current = null;
    }
  }, [councilModels, moderatorIndex, messages, input, imageFile, setMessages, setInput, dispatchCouncilEvent]);

  // Unified submit handler
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (chatMode === 'council') {
      await handleCouncilSubmit();
    } else {
      await handleSingleSubmit();
    }
  }, [chatMode, handleCouncilSubmit, handleSingleSubmit, input]);

  // Model installation check
  const checkAndInstallModel = useCallback(async (modelName: string) => {
    try {
      setIsInstalling(true);
      setInstallMessage(`Checking ${modelName} installation...`);

      const checkResponse = await fetch(`/api/check-model?model=${modelName}`);
      if (!checkResponse.ok) throw new Error('Check failed');

      const { installed } = await checkResponse.json();

      if (!installed) {
        setInstallMessage(`Downloading ${modelName}...`);

        const installResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName, installOnly: true })
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
  }, []);

  useEffect(() => {
    if (chatMode === 'single') {
      checkAndInstallModel(model);
    } else {
      const checkAll = async () => {
        for (const m of councilModels) {
          await checkAndInstallModel(m);
        }
      };
      checkAll();
    }
  }, [chatMode, model, councilModels, checkAndInstallModel]);

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
          <div key={index} className="bg-retro-surface retro-sunken p-2 italic text-retro-amber">
            {"[Thinking] " + thinkContent}
          </div>
        );
      }
      return part.split('**').map((text, i) =>
        i % 2 ? <strong key={`${index}-${i}`}>{text}</strong> : text
      );
    });
  };

  // Council progress indicator
  const renderCouncilProgress = () => {
    if (councilState.phase === 'idle' || councilState.phase === 'complete') return null;

    return (
      <div className="flex justify-start">
        <div className="bg-retro-surface retro-raised p-4 max-w-[85%] border-l-4 border-retro-green">
          <p className="text-retro-green mb-3">
            {councilState.phase === 'individual'
              ? '> Council is deliberating...'
              : councilState.phase === 'synthesizing'
                ? '> Synthesizing consensus...'
                : '> ERROR: Council encountered an error'}
          </p>

          {/* Per-model status */}
          <div className="space-y-2 mb-3">
            {councilState.individualResponses.map((resp) => (
              <div key={resp.index} className="flex items-center gap-2">
                <div className="w-24 shrink-0">
                  <div className="h-2 bg-retro-border-dark overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        resp.status === 'complete' ? 'bg-retro-green'
                          : resp.status === 'streaming' ? 'bg-retro-cyan council-pulse'
                            : resp.status === 'error' ? 'bg-retro-red'
                              : 'bg-retro-border'
                      }`}
                      style={{ width: resp.status === 'complete' || resp.status === 'error' ? '100%' : resp.status === 'streaming' ? '66%' : '0%' }}
                    />
                  </div>
                </div>
                <span className="text-retro-text">{resp.model}</span>
                <span className={`text-sm ${
                  resp.status === 'complete' ? 'text-retro-green'
                    : resp.status === 'streaming' ? 'text-retro-cyan'
                      : resp.status === 'error' ? 'text-retro-red'
                        : 'text-retro-border-light'
                }`}>
                  [{resp.status === 'complete' ? 'OK'
                    : resp.status === 'streaming' ? 'RECV'
                      : resp.status === 'error' ? 'FAIL'
                        : 'WAIT'}]
                </span>
              </div>
            ))}
          </div>

          {/* Synthesis progress */}
          {councilState.phase === 'synthesizing' && (
            <div className="border-t border-retro-border pt-2">
              <p className="text-retro-amber text-sm">
                Moderator ({councilState.moderatorModel}) building consensus...
              </p>
              {councilState.consensusText && (
                <div className="mt-2 prose prose-sm text-retro-text">
                  {renderMessageContent(councilState.consensusText)}
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {councilState.phase === 'error' && (
            <p className="text-retro-red border-t border-retro-border pt-2">
              ERROR: Council deliberation failed. Retry.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-retro-bg text-retro-text">
      <InstallDialog isOpen={isInstalling} message={installMessage} />

      <header className="sticky top-0 bg-retro-surface retro-raised z-10">
        <div className="retro-titlebar flex items-center justify-between">
          <h1 className="text-retro-green text-lg tracking-wider">[OllaWeb v2.0]</h1>
          <div className="flex gap-2 text-retro-text text-sm">
            <span className="retro-raised bg-retro-surface px-1 cursor-default">_</span>
            <span className="retro-raised bg-retro-surface px-1 cursor-default">[]</span>
            <span className="retro-raised bg-retro-surface px-1 cursor-default">X</span>
          </div>
        </div>
        <div className="container mx-auto px-4 py-2 flex items-center justify-end">
          <CouncilSelector
            chatMode={chatMode}
            onModeChange={setChatMode}
            singleModel={model}
            onSingleModelChange={setModel}
            councilModels={councilModels}
            onCouncilModelsChange={setCouncilModels}
            moderatorIndex={moderatorIndex}
            onModeratorIndexChange={setModeratorIndex}
          />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (message as any).councilData ? (
                <CouncilResponse
                  consensusText={message.content}
                  individualResponses={(message as any).councilData}
                  renderMessageContent={renderMessageContent}
                />
              ) : (
                <div className={`p-3 max-w-[85%] retro-raised ${
                  message.role === 'user'
                    ? 'bg-retro-user-bg text-retro-cyan'
                    : 'bg-retro-assistant-bg text-retro-text'
                }`}>
                  <div className="prose">
                    {renderMessageContent(message.content)}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Council progress */}
          {renderCouncilProgress()}

          {/* Single AI typing indicator — retro blinking cursor */}
          {isTyping && chatMode === 'single' && (
            <div className="flex justify-start">
              <div className="bg-retro-assistant-bg retro-raised p-3">
                <span className="text-retro-green retro-blink">█</span>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 bg-retro-surface retro-raised">
        <div className="max-w-4xl mx-auto p-3">
          {imagePreview && (
            <div className="flex justify-center mb-2">
              <img
                src={imagePreview}
                alt="Uploaded content"
                className="w-20 h-auto retro-sunken"
              />
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={!hasVisionModel}
              ref={fileInputRef}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!hasVisionModel}
              className={`px-3 py-1 retro-raised flex items-center justify-center ${
                hasVisionModel
                  ? 'bg-retro-panel text-retro-text-bright hover:bg-retro-blue active:retro-sunken'
                  : 'bg-retro-border-dark text-retro-border cursor-not-allowed'
              }`}
            >
              [IMG]
            </button>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={chatMode === 'council' ? "> Query the council..." : "> Enter command..."}
              className="flex-1 px-4 py-2"
            />
            {isResponding && chatMode === 'council' ? (
              <button
                type="button"
                onClick={() => abortControllerRef.current?.abort()}
                className="px-3 py-1 retro-raised bg-retro-surface text-retro-red hover:bg-retro-red hover:text-retro-text-bright flex items-center justify-center"
              >
                [ABORT]
              </button>
            ) : (
              <button
                type="submit"
                disabled={isTyping || isResponding}
                className="px-3 py-1 retro-raised bg-retro-panel text-retro-green hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                [SEND]
              </button>
            )}
          </form>
        </div>
      </footer>
    </div>
  );
}
