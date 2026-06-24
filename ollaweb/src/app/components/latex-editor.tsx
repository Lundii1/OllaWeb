"use client";

import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
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
  const readOnlyCompartmentRef = useRef(new Compartment());
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
            fontSize: '13px',
            backgroundColor: 'transparent !important',
          },
          '.cm-scroller': {
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            scrollbarWidth: 'thin',
            scrollbarColor: '#333 transparent',
          },
          '.cm-gutters': {
            backgroundColor: 'transparent !important',
            borderRight: '1px solid #333 !important',
            color: '#666',
            minWidth: '40px',
            textAlign: 'right',
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(255, 255, 255, 0.03) !important',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'rgba(255, 255, 255, 0.03) !important',
            color: '#fff',
          },
          '.cm-content': {
            caretColor: '#fff',
            padding: '10px 0',
          },
          '.cm-cursor': {
            borderLeftColor: '#fff',
          },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
            backgroundColor: 'rgba(255, 255, 255, 0.1) !important',
          },
        }),
        readOnlyCompartmentRef.current.of(EditorState.readOnly.of(readOnly)),
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

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

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
      className="bg-[#0f0f0f] border border-[#333] rounded-xl overflow-hidden h-full shadow-inner"
    />
  );
}
