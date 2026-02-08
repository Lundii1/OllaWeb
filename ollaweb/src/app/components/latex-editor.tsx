"use client";

import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { latex } from 'codemirror-lang-latex';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

interface LaTeXEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function LaTeXEditor({ value, onChange, readOnly = false }: LaTeXEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        latex(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
          },
          '.cm-scroller': {
            fontFamily: '"Courier New", monospace',
          },
          '.cm-content': {
            caretColor: '#39ff14',
          },
          '.cm-cursor': {
            borderLeftColor: '#39ff14',
          },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
            backgroundColor: '#0f3460 !important',
          },
        }),
        ...(readOnly ? [EditorState.readOnly.of(true)] : []),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create editor once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. from streaming)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="retro-sunken overflow-auto h-full"
    />
  );
}
