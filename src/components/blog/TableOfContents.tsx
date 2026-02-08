import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface TocEntry {
  level: number
  text: string
  slug: string
}

interface TableOfContentsProps {
  headings: TocEntry[]
  activeSlug: string
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function TableOfContents({ headings, activeSlug }: TableOfContentsProps) {
  if (headings.length === 0) return null

  return (
    <nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        On This Page
      </p>
      <ScrollArea className="max-h-[calc(100vh-12rem)]">
        <ul className="border-l border-border">
          {headings.map((heading) => (
            <li key={heading.slug}>
              <a
                href={`#${heading.slug}`}
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById(heading.slug)
                    ?.scrollIntoView({ behavior: "smooth" })
                }}
                className={cn(
                  "block border-l-2 -ml-px py-1.5 text-sm transition-colors",
                  heading.level === 3 ? "pl-6" : "pl-4",
                  activeSlug === heading.slug
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </nav>
  )
}
