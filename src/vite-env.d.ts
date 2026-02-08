/// <reference types="vite/client" />

declare module "react-syntax-highlighter/dist/esm/prism-light" {
  import { SyntaxHighlighterProps } from "react-syntax-highlighter"
  const SyntaxHighlighter: {
    (props: SyntaxHighlighterProps): JSX.Element
    registerLanguage(name: string, grammar: unknown): void
  }
  export default SyntaxHighlighter
}

declare module "react-syntax-highlighter/dist/esm/styles/prism/one-dark" {
  const style: Record<string, React.CSSProperties>
  export default style
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/typescript" {
  const language: unknown
  export default language
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/tsx" {
  const language: unknown
  export default language
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/json" {
  const language: unknown
  export default language
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/bash" {
  const language: unknown
  export default language
}
