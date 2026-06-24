'use client';

import React from 'react';
import { classifyError } from './performance-utils';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Additional error reporting could be added here
  }

  render(): React.ReactNode {
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

// Specialized error boundaries for different components
export class ChatErrorBoundary extends ErrorBoundary {
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-[#2f2f2f] border border-red-500/50 rounded-xl text-red-400 text-sm">
          <div className="font-semibold mb-2">Chat Error</div>
          <div className="mb-2">The chat system encountered an error. Please try again.</div>
          <div className="text-muted-foreground text-xs">If this persists, restart Ollama or check your model installation.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export class FinanceErrorBoundary extends ErrorBoundary {
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-[#2f2f2f] border border-red-500/50 rounded-xl text-red-400 text-sm">
          <div className="font-semibold mb-2">Finance Error</div>
          <div className="mb-2">Unable to fetch financial data. Please check your connection.</div>
          <div className="text-muted-foreground text-xs">Try refreshing the page or checking Yahoo Finance API status.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export class ResumeErrorBoundary extends ErrorBoundary {
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-[#2f2f2f] border border-red-500/50 rounded-xl text-red-400 text-sm">
          <div className="font-semibold mb-2">Resume Error</div>
          <div className="mb-2">Failed to process resume. Please check your file format.</div>
          <div className="text-muted-foreground text-xs">Ensure your PDF is valid and try again.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Higher-order component for error boundaries
export function withErrorBoundary<T extends React.ComponentType<any>>(
  Component: T,
  Boundary: typeof ErrorBoundary = ErrorBoundary,
  fallback?: React.ReactNode
) {
  const WrappedComponent = (props: React.ComponentProps<T>) => {
    return (
      <Boundary fallback={fallback}>
        <Component {...props} />
      </Boundary>
    );
  };

  return WrappedComponent;
}

// Global error handler
export function setupGlobalErrorHandler() {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Additional global error handling can be added here
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Additional unhandled rejection handling can be added here
  });
}

// Performance monitoring
export function monitorPerformance(componentName: string, operation: () => void) {
  const start = performance.now();
  operation();
  const duration = performance.now() - start;

  if (duration > 100) {
    console.warn(`Performance warning: ${componentName} took ${duration.toFixed(2)}ms`);
  }
}

// Optimized error reporting
export function reportError(error: Error, context?: string) {
  console.error(`Error in ${context || 'unknown context'}:`, error);
  // Additional error reporting to external services can be added here
}