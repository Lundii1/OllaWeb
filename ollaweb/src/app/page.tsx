"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ImagePlus } from "lucide-react";
import { CouncilSelector } from "./components/council-selector";
import { CouncilResponse } from "./components/council-response";
import { AVAILABLE_MODELS, DEFAULT_COUNCIL_MODELS } from "../lib/types";
import type { ChatMode, CouncilState, CouncilEvent, IndividualResponse, Message, Conversation } from "../lib/types";
import { ChatHistory } from "./components/chat-history";
import {
  AppFooter,
  AppHeader,
  AppMain,
  AppShell,
  AppSidebar,
  StatusToast,
} from "./components/app-shell";
import { Persona } from "./components/persona";
import type { PersonaState } from "./components/persona";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai/reasoning";
import { MarkdownMessage } from "./components/markdown-message";
import { listConversations, getConversation, saveConversation, deleteConversation as deleteConvo, generateTitle, getSavedCouncilConfig, setSavedCouncilConfig } from "../lib/conversation-storage";
import { applyCouncilEvent, createCouncilResult } from "../lib/council-result";
import { splitChatContent } from "../lib/chat-content";

export default function Chat() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const conversationDirtyRef = useRef(false);

  const [model, setModel] = useState<string>(AVAILABLE_MODELS[0].value);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const isRespondingRef = useRef(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [debateEnabled, setDebateEnabled] = useState(false);

  // Chat history state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [savedConversations, setSavedConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Council state — initialize directly from localStorage to avoid race conditions
  const [chatMode, setChatMode] = useState<ChatMode>('single');
  const handleModeChange = useCallback((mode: ChatMode) => {
    setChatMode(mode);
    if (mode === 'single') {
      setModel((prev: string) => AVAILABLE_MODELS.some(m => m.value === prev) ? prev : AVAILABLE_MODELS[0].value);
    }
  }, []);
  const [councilModels, setCouncilModels] = useState<[string, string, string]>(() => {
    const saved = typeof window !== 'undefined' ? getSavedCouncilConfig() : null;
    const availableModels = new Set<string>(AVAILABLE_MODELS.map(m => m.value));
    return saved?.models?.every(m => availableModels.has(m))
      ? [...saved.models]
      : [...DEFAULT_COUNCIL_MODELS];
  });
  const [moderatorIndex, setModeratorIndex] = useState(() => {
    const saved = typeof window !== 'undefined' ? getSavedCouncilConfig() : null;
    return saved?.moderatorIndex ?? 0;
  });
  const [councilState, setCouncilState] = useState<CouncilState>({
    phase: 'idle',
    individualResponses: [],
    consensusText: '',
    moderatorModel: '',
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);
  const [isTyping, setIsTyping] = useState(false);
  const isTypingRef = useRef(false);

  // Load saved conversations on mount
  useEffect(() => {
    setSavedConversations(listConversations());
  }, []);

  // Auto-save council config whenever models or moderator change
  useEffect(() => {
    setSavedCouncilConfig({ models: councilModels, moderatorIndex });
  }, [councilModels, moderatorIndex]);

  // Sync refs with state for stale-closure-safe access
  const currentConversationIdRef = useRef(currentConversationId);
  currentConversationIdRef.current = currentConversationId;
  isRespondingRef.current = isResponding;
  isTypingRef.current = isTyping;

  useEffect(() => {
    if (isResponding || messages.length === 0 || !conversationDirtyRef.current) return;
    const id = currentConversationIdRef.current;
    if (!id) return;

    const existing = getConversation(id);
    const convo: Conversation = {
      id,
      title: generateTitle(messages as Message[]),
      messages: (messages as Message[]).map(m => ({ ...m, image: undefined })),
      chatMode,
      model,
      councilModels: chatMode === 'council' ? councilModels : undefined,
      moderatorIndex: chatMode === 'council' ? moderatorIndex : undefined,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    saveConversation(convo);
    conversationDirtyRef.current = false;
    setSavedConversations(listConversations());
  }, [isResponding, messages, chatMode, model, councilModels, moderatorIndex]);

  const cancelActiveRequest = useCallback(() => {
    activeRequestIdRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isRespondingRef.current = false;
    isTypingRef.current = false;
    setIsResponding(false);
    setIsTyping(false);
  }, []);

  const handleNewChat = useCallback(() => {
    cancelActiveRequest();
    conversationDirtyRef.current = false;
    setMessages([]);
    setCurrentConversationId(null);
    setInput("");
    setImageFile(null);
    setImagePreview(null);
    if (inputRef.current) inputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCouncilState({ phase: 'idle', individualResponses: [], consensusText: '', moderatorModel: '' });
  }, [cancelActiveRequest]);

  const handleSelectConversation = useCallback((id: string) => {
    const convo = getConversation(id);
    if (!convo) return;
    cancelActiveRequest();
    conversationDirtyRef.current = false;
    setMessages(convo.messages as any);
    setCurrentConversationId(id);
    setChatMode(convo.chatMode);
    setModel(convo.model);
    // Council config is universal — don't override from per-conversation data
    setCouncilState({ phase: 'idle', individualResponses: [], consensusText: '', moderatorModel: '' });
  }, [cancelActiveRequest]);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConvo(id);
    setSavedConversations(listConversations());
    if (id === currentConversationId) {
      handleNewChat();
    }
  }, [currentConversationId, handleNewChat]);

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
  const visionModelValues: string[] = AVAILABLE_MODELS.filter(m => m.vision).map(m => m.value);
  const hasVisionModel = chatMode === 'single'
    ? visionModelValues.includes(model)
    : councilModels.some(m => visionModelValues.includes(m));

  // Single AI submit handler (existing logic)
  const handleSingleSubmit = useCallback(async (
    submittedInput: string,
    priorMessages: Message[],
    currentImageFile: File | null,
    requestId: string
  ) => {
    setIsResponding(true);
    setIsTyping(true);

    // Auto-prefix with web: when search toggle is enabled
    const effectiveInput = (webSearchEnabled && !submittedInput.trim().match(/^web:\s/i))
      ? `web: ${submittedInput}`
      : submittedInput;

    const formData = new FormData();
    if (currentImageFile) formData.append("image", currentImageFile);

    const requestMessages = [
      ...priorMessages.map(message => ({ role: message.role, content: message.content })),
      { role: 'user', content: effectiveInput }
    ];

    formData.append("messages", JSON.stringify(requestMessages));
    formData.append("model", model);

    const assistantMessageId = Date.now().toString() + '-assistant';
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || err?.error || `Chat request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Chat response did not include a readable stream');

      const decoder = new TextDecoder();
      let responseText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (activeRequestIdRef.current !== requestId) {
          await reader.cancel();
          return;
        }
        if (done) {
          responseText += decoder.decode();
          break;
        }
        responseText += decoder.decode(value, { stream: true });

        setMessages(prev => {
          if (activeRequestIdRef.current !== requestId) return prev;
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
      if ((error as Error).name === 'AbortError' || activeRequestIdRef.current !== requestId) return;
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown chat error';
      setMessages(prev => {
        const existingMessageIndex = prev.findIndex(msg => msg.id === assistantMessageId);
        if (existingMessageIndex !== -1) {
          const updated = [...prev];
          updated[existingMessageIndex] = {
            ...updated[existingMessageIndex],
            content: `Error: ${errorMessage}`
          };
          return updated;
        }

        return [...prev, {
          id: assistantMessageId,
          role: 'assistant',
          content: `Error: ${errorMessage}`
        }];
      });
    } finally {
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null;
        abortControllerRef.current = null;
        setIsResponding(false);
        setIsTyping(false);
      }
    }
  }, [model, setMessages, webSearchEnabled]);

  // Council event dispatcher
  const dispatchCouncilEvent = useCallback((event: CouncilEvent) => {
    setCouncilState(prev => {
      switch (event.event) {
        case 'health_check':
          return { ...prev, phase: 'health_check' };
        case 'individual_start': {
          const updated = [...prev.individualResponses];
          updated[event.payload.index] = {
            ...updated[event.payload.index],
            status: 'streaming',
          };
          return { ...prev, phase: 'individual', individualResponses: updated };
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
            errorAction: event.payload.action,
          };
          return { ...prev, individualResponses: updated };
        }
        case 'debate_start':
          return { ...prev, phase: 'debating' };
        case 'debate_chunk':
          return prev; // debate details are internal
        case 'debate_complete':
          return prev; // synthesis_start will follow
        case 'synthesis_start':
          return { ...prev, phase: 'synthesizing', moderatorModel: event.payload.moderator };
        case 'synthesis_chunk':
          return { ...prev, consensusText: prev.consensusText + event.payload.text };
        case 'synthesis_complete':
          return { ...prev, phase: 'complete', consensusText: event.payload.fullText, confidence: event.payload.confidence };
        case 'error':
          return { ...prev, phase: 'error' };
        default:
          return prev;
      }
    });
  }, []);

  // Council submit handler
  const handleCouncilSubmit = useCallback(async (
    submittedInput: string,
    priorMessages: Message[],
    currentImageFile: File | null,
    requestId: string
  ) => {
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

    // Auto-prefix with web: when search toggle is enabled
    const currentInput = (webSearchEnabled && !submittedInput.trim().match(/^web:\s/i))
      ? `web: ${submittedInput}`
      : submittedInput;
    const formData = new FormData();
    const requestMessages = [
      ...priorMessages.map(message => ({ role: message.role, content: message.content })),
      { role: 'user', content: currentInput }
    ];
    formData.append('messages', JSON.stringify(requestMessages));
    formData.append('models', JSON.stringify(councilModels));
    formData.append('moderatorIndex', moderatorIndex.toString());
    if (debateEnabled) formData.append('enableDebate', 'true');
    if (currentImageFile) formData.append('image', currentImageFile);
    let finalCouncilResult = createCouncilResult(councilModels);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch('/api/council', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || err?.error || `Council request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Council response did not include a readable stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (activeRequestIdRef.current !== requestId) {
          await reader.cancel();
          return;
        }
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: CouncilEvent = JSON.parse(line.slice(6));
            dispatchCouncilEvent(event);
            finalCouncilResult = applyCouncilEvent(finalCouncilResult, event);
          } catch {
            // Skip malformed events
          }
        }
      }

      if (activeRequestIdRef.current !== requestId) return;

      if (finalCouncilResult.complete && finalCouncilResult.consensusText) {
        setMessages(msgs => [...msgs, {
          id: `${requestId}-council`,
          role: 'assistant',
          content: finalCouncilResult.consensusText,
          councilData: finalCouncilResult.individualResponses,
          councilConfidence: finalCouncilResult.confidence,
        }]);
      }
      setCouncilState(prev => ({ ...prev, phase: 'idle' }));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        if (activeRequestIdRef.current === requestId) {
          if (finalCouncilResult.consensusText) {
            setMessages(msgs => [...msgs, {
              id: `${requestId}-council-stopped`,
              role: 'assistant',
              content: finalCouncilResult.consensusText + '\n\n*[Council deliberation was stopped]*',
              councilData: finalCouncilResult.individualResponses,
            }]);
          }
          setCouncilState(prev => ({ ...prev, phase: 'idle' }));
        }
      } else if (activeRequestIdRef.current === requestId) {
        console.error("Council error:", error);
        setCouncilState(prev => ({ ...prev, phase: 'error' }));
      }
    } finally {
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null;
        abortControllerRef.current = null;
        setIsResponding(false);
      }
    }
  }, [councilModels, moderatorIndex, setMessages, dispatchCouncilEvent, webSearchEnabled, debateEnabled]);

  const submitCurrentInput = useCallback(async () => {
    if (isRespondingRef.current || isTypingRef.current) return;
    const submittedInput = inputRef.current?.value ?? input;
    if (!submittedInput.trim()) return;

    const requestId = crypto.randomUUID();
    activeRequestIdRef.current = requestId;
    conversationDirtyRef.current = true;

    const currentImageFile = imageFile;
    const imageUrl = imagePreview || (currentImageFile ? URL.createObjectURL(currentImageFile) : undefined);

    setInput("");
    if (inputRef.current) inputRef.current.value = "";
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: submittedInput,
      image: imageUrl,
    }]);

    // Create a new conversation ID if this is the first message
    if (!currentConversationId) {
      const newId = Date.now().toString();
      setCurrentConversationId(newId);
      currentConversationIdRef.current = newId;
    }

    if (chatMode === 'council') {
      await handleCouncilSubmit(submittedInput, messages, currentImageFile, requestId);
    } else {
      await handleSingleSubmit(submittedInput, messages, currentImageFile, requestId);
    }
  }, [chatMode, handleCouncilSubmit, handleSingleSubmit, imageFile, imagePreview, input, messages, currentConversationId, isResponding, isTyping]);

  // Unified submit handler
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitCurrentInput();
  }, [submitCurrentInput]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submitCurrentInput();
  }, [submitCurrentInput]);

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

        if (!installResponse.ok) {
          const err = await installResponse.json().catch(() => null);
          throw new Error(err?.error || `Download failed (${installResponse.status})`);
        }

        if (!installResponse.body) throw new Error('Model download did not include progress stream');

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

  const renderMessageContent = (content: string, streaming = false) => {
    const { visibleContent, reasoningContent, reasoningComplete } = splitChatContent(content);
    const isThinkStreaming = streaming && !reasoningComplete;

    return (
      <>
        {reasoningContent.length > 2 && (
          <Reasoning defaultOpen={isThinkStreaming || streaming} isStreaming={isThinkStreaming}>
            <ReasoningTrigger />
            <ReasoningContent>{reasoningContent}</ReasoningContent>
          </Reasoning>
        )}
        {visibleContent && <MarkdownMessage content={visibleContent} />}
      </>
    );
  };

  // Derive persona state from chat activity
  const personaState: PersonaState = isResponding
    ? "thinking"
    : isTyping
      ? "speaking"
      : input.trim().length > 0
        ? "listening"
        : "idle";

  // Council progress indicator
  const completedCount = councilState.individualResponses.filter(r => r.status === 'complete').length;

  const renderCouncilProgress = () => {
    if (councilState.phase === 'idle' || councilState.phase === 'complete') return null;

    return (
      <div className="flex justify-start">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 max-w-[85%] border-l-4 border-emerald-500">
          <p className="text-emerald-400 mb-3">
            {councilState.phase === 'health_check'
              ? 'Warming up models...'
              : councilState.phase === 'individual'
                ? 'Council is deliberating...'
                : councilState.phase === 'debating'
                  ? 'Council is debating disagreements...'
                  : councilState.phase === 'synthesizing'
                    ? 'Synthesizing consensus...'
                    : 'Council encountered an error'}
          </p>

          {/* Per-model status */}
          <div className="space-y-2 mb-3">
            {councilState.individualResponses.map((resp) => (
              <div key={resp.index} className="flex items-center gap-2">
                <div className="w-24 shrink-0">
                  <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        resp.status === 'complete' ? 'bg-emerald-500'
                          : resp.status === 'streaming' ? 'bg-cyan-500 council-pulse'
                            : resp.status === 'error' ? 'bg-red-500'
                              : 'bg-[#333]'
                      }`}
                      style={{ width: resp.status === 'complete' || resp.status === 'error' ? '100%' : resp.status === 'streaming' ? '66%' : '0%' }}
                    />
                  </div>
                </div>
                <span className="text-muted-foreground">{resp.model}</span>
                <span className={`text-sm ${
                  resp.status === 'complete' ? 'text-emerald-400'
                    : resp.status === 'streaming' ? 'text-cyan-400'
                      : resp.status === 'error' ? 'text-red-400'
                        : 'text-muted-foreground'
                }`}>
                  [{resp.status === 'complete' ? 'OK'
                    : resp.status === 'streaming' ? 'RECV'
                      : resp.status === 'error' ? 'FAIL'
                        : 'WAIT'}]
                </span>
                {resp.status === 'error' && resp.error && (
                  <span className="text-red-400 text-sm">— {resp.error}</span>
                )}
                {resp.status === 'error' && resp.errorAction && (
                  <span className="text-orange-400 text-sm">→ {resp.errorAction}</span>
                )}
              </div>
            ))}
          </div>

          {/* Synthesis progress */}
          {councilState.phase === 'synthesizing' && (
            <div className="border-t border-border pt-2">
              <p className="text-orange-400 text-sm">
                Moderator ({councilState.moderatorModel}) building consensus...
              </p>
              {councilState.consensusText && (
                <div className="mt-2 prose prose-sm text-foreground">
                  {renderMessageContent(councilState.consensusText)}
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {councilState.phase === 'error' && (
            <p className="text-red-400 border-t border-border pt-2">
              Council deliberation failed. Retry.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      {isInstalling && <StatusToast>{installMessage}</StatusToast>}

      <AppSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        currentPage="chat"
        expandedLabel="Hide conversations"
        collapsedLabel="Show conversations"
        top={
          <button
            onClick={handleNewChat}
            className="w-full min-w-0 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            + New Chat
          </button>
        }
      >
        <ChatHistory
          conversations={savedConversations}
          currentConversationId={currentConversationId}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(open => !open)}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
          onNewChat={handleNewChat}
        />
      </AppSidebar>

      <AppMain>
        <AppHeader
          actions={
            <CouncilSelector
              chatMode={chatMode}
              onModeChange={handleModeChange}
              singleModel={model}
              onSingleModelChange={setModel}
              councilModels={councilModels}
              onCouncilModelsChange={setCouncilModels}
              moderatorIndex={moderatorIndex}
              onModeratorIndexChange={setModeratorIndex}
              debateEnabled={debateEnabled}
              onDebateEnabledChange={setDebateEnabled}
            />
          }
        />

          <main className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <Persona state={personaState} variant="halo" className="size-24" />
                <p className="text-muted-foreground text-sm">Ask me anything...</p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((message, msgIndex) => {
                  const isLast = msgIndex === messages.length - 1;
                  const isLastAssistant = message.role === 'assistant' && isLast;
                  const isActivelyStreaming = isLastAssistant && isResponding;
                  const showPersona = isLast && message.role === 'assistant';
                  return (
                    <div
                      key={message.id}
                      className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'assistant' && (message as any).councilData ? (
                        <div className="flex w-full min-w-0 items-start gap-3">
                          <div className="size-12 shrink-0 mt-0.5">
                            {showPersona && (
                              <Persona state={personaState} variant="halo" className="size-full" />
                            )}
                          </div>
                          <CouncilResponse
                            consensusText={message.content}
                            individualResponses={(message as any).councilData}
                            confidence={(message as any).councilConfidence}
                            renderMessageContent={renderMessageContent}
                          />
                        </div>
                      ) : message.role === 'user' ? (
                        <div className="min-w-0 max-w-[85%] rounded-xl px-4 py-3 bg-white/10 backdrop-blur-sm text-foreground">
                          <div className="min-w-0">
                            {renderMessageContent(message.content, isActivelyStreaming)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex w-full min-w-0 items-start gap-3">
                          <div className="size-12 shrink-0 mt-0.5">
                            {showPersona && (
                              <Persona state={personaState} variant="halo" className="size-full" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-[85%] text-foreground">
                            {renderMessageContent(message.content, isActivelyStreaming)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Council progress */}
                {renderCouncilProgress()}


              </div>
            )}
          </main>

          <AppFooter>
              {imagePreview && (
                <div className="flex justify-center mb-2">
                  <img
                    src={imagePreview}
                    alt="Uploaded content"
                    className="w-20 h-auto rounded-md border border-white/10"
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
                  title={hasVisionModel ? "Upload image" : "Selected model does not support images"}
                  aria-label="Upload image"
                  className={`inline-flex size-9 items-center justify-center rounded-md border transition-colors ${
                    hasVisionModel
                      ? 'bg-white/5 border-white/10 text-foreground hover:bg-white/10'
                      : 'bg-white/5 border-white/10 text-muted-foreground cursor-not-allowed opacity-40'
                  }`}
                >
                  <ImagePlus className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setWebSearchEnabled(prev => !prev)}
                  title={webSearchEnabled ? "Web search enabled — click to disable" : "Enable web search"}
                  aria-pressed={webSearchEnabled}
                  aria-label={webSearchEnabled ? "Disable web search" : "Enable web search"}
                  className={`inline-flex size-9 items-center justify-center rounded-md border transition-colors ${
                    webSearchEnabled
                      ? 'bg-blue-600/20 border-blue-600/30 text-blue-400'
                      : 'bg-white/5 border-white/10 text-foreground hover:bg-white/10'
                  }`}
                >
                  <svg stroke="currentColor" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-4" strokeWidth="1.33" aria-hidden="true">
                    <path d="M0.665039 7.33166H13.9984M0.665039 7.33166C0.665039 11.0136 3.64981 13.9983 7.33171 13.9983M0.665039 7.33166C0.665039 3.64976 3.64981 0.664993 7.33171 0.664993M13.9984 7.33166C13.9984 11.0136 11.0136 13.9983 7.33171 13.9983M13.9984 7.33166C13.9984 3.64976 11.0136 0.664993 7.33171 0.664993M7.33171 0.664993C8.99923 2.49056 9.94687 4.85968 9.99837 7.33166C9.94687 9.80364 8.99923 12.1728 7.33171 13.9983M7.33171 0.664993C5.66419 2.49056 4.71654 4.85968 4.66504 7.33166C4.71654 9.80364 5.66419 12.1728 7.33171 13.9983" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder={chatMode === 'council' ? "Query the council..." : "Enter command..."}
                  className="flex-1 px-4 py-2 bg-black/30 text-foreground border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:outline-none placeholder:text-muted-foreground"
                />
                {isResponding && chatMode === 'council' ? (
                  <button
                    type="button"
                    onClick={() => abortControllerRef.current?.abort()}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                      completedCount >= 2
                        ? 'bg-white/5 border-white/10 text-orange-400 hover:bg-orange-600/20'
                        : 'bg-white/5 border-white/10 text-red-400 hover:bg-red-600/20'
                    }`}
                  >
                    {completedCount >= 2 ? '[SKIP]' : '[ABORT]'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isTyping || isResponding}
                    aria-label="Send message"
                    title="Send message"
                    className="inline-flex size-9 items-center justify-center rounded-md bg-white/10 border border-white/10 text-foreground hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-4" aria-hidden="true">
                      <path d="M8 13.3333V2.66667M8 2.66667L4 6.66667M8 2.66667L12 6.66667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33" />
                    </svg>
                  </button>
                )}
              </form>
          </AppFooter>
      </AppMain>
    </AppShell>
  );
}
