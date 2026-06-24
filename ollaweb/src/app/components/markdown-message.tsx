"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "./code-block";

function normalizeMathDelimiters(input: string) {
  return input
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}

function stripThinkTags(input: string) {
  return input
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
    .replace(/<\/?think>/gi, "");
}

export function MarkdownMessage({ content }: { content: string }) {
  const normalized = normalizeMathDelimiters(stripThinkTags(content ?? ""));

  return (
    <div className="prose prose-invert max-w-none prose-p:leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children }) {
            const text = String(children ?? "");
            const match = /language-(\w+)/.exec(className || "");
            const language = match?.[1] || "text";

            if (match) {
              return <CodeBlock code={text.replace(/\n$/, "")} language={language} />;
            }

            return (
              <code className="bg-[#2f2f2f] border border-[#404040] rounded px-1 py-0.5 text-[0.9em]">
                {text}
              </code>
            );
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
