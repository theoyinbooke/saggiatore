import type { Components } from "react-markdown"
import { IconExternalLink } from "@tabler/icons-react"
import { CodeBlock } from "./CodeBlock"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function extractText(children: unknown): string {
  return String(
    Array.isArray(children) ? children.join("") : children ?? ""
  )
}

export const markdownComponents: Components = {
  pre({ children }) {
    // Strip default <pre> wrapper — CodeBlock provides its own container
    return <>{children}</>
  },

  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "")
    const code = String(children).replace(/\n$/, "")

    // Fenced block with language
    if (match) {
      return <CodeBlock language={match[1]}>{code}</CodeBlock>
    }

    // Fenced block without language (multi-line content)
    if (code.includes("\n")) {
      return <CodeBlock language="text">{code}</CodeBlock>
    }

    // Inline code
    return (
      <code
        className="bg-muted rounded px-1.5 py-0.5 text-sm font-mono text-primary"
        {...props}
      >
        {children}
      </code>
    )
  },

  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4">
        {children}
      </blockquote>
    )
  },

  a({ href, children }) {
    const isExternal = href?.startsWith("http")
    return (
      <a
        href={href}
        className="text-primary underline underline-offset-4 hover:text-primary/80"
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
        {isExternal && (
          <IconExternalLink className="inline h-3 w-3 ml-0.5 -mt-0.5" />
        )}
      </a>
    )
  },

  img({ src, alt }) {
    return (
      <figure className="my-4">
        <img src={src} alt={alt ?? ""} className="rounded-lg shadow-sm w-full" />
        {alt && (
          <figcaption className="mt-2 text-center text-sm text-muted-foreground">
            {alt}
          </figcaption>
        )}
      </figure>
    )
  },

  table({ children }) {
    return <Table>{children}</Table>
  },
  thead({ children }) {
    return <TableHeader>{children}</TableHeader>
  },
  tbody({ children }) {
    return <TableBody>{children}</TableBody>
  },
  tr({ children }) {
    return <TableRow>{children}</TableRow>
  },
  th({ children }) {
    return <TableHead>{children}</TableHead>
  },
  td({ children }) {
    return <TableCell>{children}</TableCell>
  },

  h2({ children }) {
    const text = extractText(children)
    return (
      <h2 id={slugify(text)} className="scroll-mt-24">
        {children}
      </h2>
    )
  },
  h3({ children }) {
    const text = extractText(children)
    return (
      <h3 id={slugify(text)} className="scroll-mt-24">
        {children}
      </h3>
    )
  },
  h4({ children }) {
    const text = extractText(children)
    return (
      <h4 id={slugify(text)} className="scroll-mt-24">
        {children}
      </h4>
    )
  },

  hr() {
    return <Separator />
  },
}
