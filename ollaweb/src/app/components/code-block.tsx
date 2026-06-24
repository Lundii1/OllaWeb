"use client"

import React, { useEffect, useRef } from "react"
import Prism from "prismjs"
import "prismjs/themes/prism-tomorrow.css"
import "prismjs/components/prism-javascript"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-tsx"

interface CodeBlockProps {
  code: string
  language: string
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current)
    }
  }, [code, language])

  return (
    <div className="relative group my-4 overflow-hidden rounded-xl border border-[#333] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2a2a2a] border-b border-[#333]">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{language}</span>
      </div>
      <pre className="m-0 p-4 bg-[#1a1a1a] overflow-x-auto custom-scrollbar">
        <code ref={codeRef} className={`language-${language} text-sm leading-relaxed`}>
          {code}
        </code>
      </pre>
    </div>
  )
}
