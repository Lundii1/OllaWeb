import React, { Component, ErrorInfo, ReactNode } from 'react';

// -----------------------------------------------------------------------------
// Error Boundary and Performance Optimization
// -----------------------------------------------------------------------------

// Centralized Error Classification
export function classifyError(error: unknown): { message: string; action: string } {
  const err = error as Error;
  const msg = err?.message?.toLowerCase() || '';

  if (msg.includes('econnrefused') || msg.includes('fetch failed'))
    return { message: 'Cannot connect to Ollama', action: 'Run "ollama serve" in a terminal' };

  if (msg.includes('not found') || msg.includes('no such model'))
    return { message: 'Model not found', action: 'Run "ollama pull <model>" to install it' };

  if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('aborted'))
    return { message: 'Model took too long to respond', action: 'Try a smaller model or check GPU load' };

  if (msg.includes('out of memory') || msg.includes('oom') || msg.includes('alloc'))
    return { message: 'Out of GPU/RAM memory', action: 'Close other applications or use a smaller model' };

  if (msg.includes('503') || msg.includes('overloaded'))
    return { message: 'Ollama is overloaded', action: 'Wait a moment and try again' };

  return { message: `Error: ${err?.message || 'Unknown error'}`, action: 'Check Ollama logs for details' };
}

// Centralized Error Boundary
export class ErrorBoundary extends Component<{
  children: ReactNode;
  fallback?: ReactNode;
}> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { message, action } = classifyError(this.state.error || new Error('Unknown error'));

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 bg-[#2f2f2f] border border-red-500/50 rounded-xl text-red-400 text-sm">
          <div className="font-semibold mb-2">Error Occurred</div>
          <div className="mb-2">{message}</div>
          <div className="text-muted-foreground text-xs">{action}</div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function createReactMemo<T extends (...args: any[]) => any>(
  Component: T,
  areEqual?: (prev: Parameters<T>[0], next: Parameters<T>[0]) => boolean
) {
  return React.memo(Component, areEqual);
}

export function useMemoize<T extends (...args: any[]) => any>(
  fn: T,
  deps: React.DependencyList
) {
  return React.useMemo(fn, deps);
}

export function useOptimizedState<T>(
  initialState: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(initialState);

  const optimizedSetState = React.useCallback((value: React.SetStateAction<T>) => {
    setState(prev =>
      typeof value === 'function'
        ? (value as (prev: T) => T)(prev)
        : value
    );
  }, []);

  return [state, optimizedSetState];
}

export function useErrorHandler() {
  return React.useCallback((error: unknown) => {
    console.error('Unhandled error:', error);
  }, []);
}

export function usePerformanceMonitor<T>(
  operation: () => T,
  label: string,
  thresholdMs = 100
): T {
  const start = performance.now();
  const result = operation();
  const duration = performance.now() - start;

  if (duration > thresholdMs) {
    console.warn(`Performance warning: ${label} took ${duration.toFixed(2)}ms`);
  }

  return result;
}

export function withSuspense<T extends object>(
  Component: React.ComponentType<T>
) {
  return function WrappedComponent(props: T) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
      return () => setMounted(false);
    }, []);

    if (!mounted) {
      return <Component {...props} />;
    }

    return (
      <React.Suspense fallback={<div className="p-2 text-muted-foreground text-sm">Loading...</div>}>
        <Component {...props} />
      </React.Suspense>
    );
  };
}

export function shallowEqual<T extends object>(prev: T, next: T): boolean {
  if (prev === next) return true;

  const prevKeys = Object.keys(prev as object);
  const nextKeys = Object.keys(next as object);

  if (prevKeys.length !== nextKeys.length) return false;

  for (const key of prevKeys) {
    if ((prev as Record<string, unknown>)[key] !== (next as Record<string, unknown>)[key]) {
      return false;
    }
  }

  return true;
}

export async function safeExecute<T>(
  operation: () => Promise<T>,
  fallback: T,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
    }
  }

  console.warn('Operation failed after retries:', lastError);
  return fallback;
}

export function createApiResponse<T>(
  data: T,
  error?: Error
): { data: T; error: Error | null } {
  return {
    data: data,
    error: error ?? null
  };
}

export async function fetchWithTimeout<T>(
  url: string,
  options?: RequestInit,
  timeout = 10000
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

export function createOptimizedContext<T>(
  defaultValue: T,
  displayName?: string
) {
  const Context = React.createContext(defaultValue);
  if (displayName) {
    Context.displayName = displayName;
  }

  const Provider = ({ value, children }: { value: T; children: React.ReactNode }) => {
    return (
      <Context.Provider value={value}>
        {children}
      </Context.Provider>
    );
  };

  return { Context, Provider };
}

export function useStateMachine<T extends string>(
  initialState: T
) {
  const [state, setState] = React.useState<T>(initialState);

  const transition = React.useCallback((nextState: T) => {
    setState(nextState);
  }, []);

  return { state, transition };
}

export function useOptimizedEffect(
  effect: React.EffectCallback,
  deps?: React.DependencyList
) {
  React.useEffect(() => {
    let isMounted = true;
    effect();
    return () => {
      isMounted = false;
    };
  }, deps);
}

export function useTimeout(callback: () => void, delay: number) {
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    const handler = () => savedCallback.current();
    const id = setTimeout(handler, delay);
    return () => clearTimeout(id);
  }, [delay]);
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const [timeoutId, setTimeoutId] = React.useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = React.useCallback((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const newTimeoutId = setTimeout(() => callback(...args), delay);
    setTimeoutId(newTimeoutId);
  }, [callback, delay]);

  return debouncedCallback;
}
