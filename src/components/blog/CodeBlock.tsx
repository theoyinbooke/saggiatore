import { useState } from "react"
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light"
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx"
import json from "react-syntax-highlighter/dist/esm/languages/prism/json"
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash"
import { IconCopy, IconCheck } from "@tabler/icons-react"

SyntaxHighlighter.registerLanguage("typescript", typescript)
SyntaxHighlighter.registerLanguage("tsx", tsx)
SyntaxHighlighter.registerLanguage("json", json)
SyntaxHighlighter.registerLanguage("bash", bash)

const DISPLAY_NAMES: Record<string, string> = {
  typescript: "TypeScript",
  tsx: "TSX",
  json: "JSON",
  bash: "Bash",
  text: "Text",
}

const HIGHLIGHTED_LANGUAGES = new Set(["typescript", "tsx", "json", "bash"])

interface CodeBlockProps {
  language: string
  children: string
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayName = DISPLAY_NAMES[language] ?? language

  return (
    <div className="rounded-lg overflow-hidden border border-border my-4">
      <div className="flex items-center px-4 py-2 bg-muted/60 border-b border-border">
        <span className="rounded-full px-3 py-0.5 text-xs font-medium bg-primary text-primary-foreground">
          {displayName}
        </span>
      </div>
      <div className="relative">
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <IconCheck className="h-4 w-4" />
          ) : (
            <IconCopy className="h-4 w-4" />
          )}
        </button>
        {HIGHLIGHTED_LANGUAGES.has(language) ? (
          <SyntaxHighlighter
            style={oneLight}
            language={language}
            customStyle={{
              margin: 0,
              padding: "1rem",
              fontSize: "0.875rem",
              background: "var(--color-muted)",
            }}
          >
            {children}
          </SyntaxHighlighter>
        ) : (
          <pre className="m-0 p-4 text-sm leading-relaxed font-mono bg-muted overflow-x-auto text-foreground/80 whitespace-pre">
            <code>{children}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
