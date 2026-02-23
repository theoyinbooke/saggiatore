import { useMemo, useState, useEffect } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import webBlogContent from "@/content/blog-post.md?raw"
import pythonBlogContent from "@/content/blog-post-python.md?raw"
import { BlogHeader } from "@/components/blog/BlogHeader"
import { TableOfContents, slugify } from "@/components/blog/TableOfContents"
import type { TocEntry } from "@/components/blog/TableOfContents"
import { markdownComponents } from "@/components/blog/MarkdownComponents"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type BlogTab = "web" | "python"

const BLOG_ARTICLES: Record<
  BlogTab,
  {
    content: string
    title: string
    subtitle: string
  }
> = {
  web: {
    content: webBlogContent,
    title: "Implementing Galileo-Powered Agent Evaluation in a Real-Time Web Stack",
    subtitle:
      "A step-by-step build guide for Convex orchestration, Galileo scoring, and live replay/leaderboard UX",
  },
  python: {
    content: pythonBlogContent,
    title: "Building a Reliable Immigration Consultation AI Agent with Galileo SDK",
    subtitle:
      "A hands-on Python implementation guide: LangChain orchestration, Galileo tracing and scoring, and Convex sync using Saggiatore as the working example.",
  },
}

export function BlogPage() {
  const [activeTab, setActiveTab] = useState<BlogTab>("web")
  const activeArticle = BLOG_ARTICLES[activeTab]

  const headings = useMemo<TocEntry[]>(() => {
    const result: TocEntry[] = []
    const regex = /^(#{2,3})\s+(.+)$/gm
    let match
    while ((match = regex.exec(activeArticle.content)) !== null) {
      result.push({
        level: match[1].length,
        text: match[2],
        slug: slugify(match[2]),
      })
    }
    return result
  }, [activeArticle.content])

  const [activeSlug, setActiveSlug] = useState("")

  useEffect(() => {
    setActiveSlug("")
  }, [activeTab])

  useEffect(() => {
    const elements = headings
      .map((h) => document.getElementById(h.slug))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id)
          }
        }
      },
      { rootMargin: "-80px 0px -65% 0px" }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [headings])

  return (
    <article className="py-8">
      <BlogHeader
        content={activeArticle.content}
        title={activeArticle.title}
        subtitle={activeArticle.subtitle}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as BlogTab)}
        className="mb-6"
      >
        <TabsList variant="line">
          <TabsTrigger value="web">Web Integration</TabsTrigger>
          <TabsTrigger value="python">Python Integration</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-10">
        {/* Sticky sidebar TOC — hidden on smaller screens */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <TableOfContents headings={headings} activeSlug={activeSlug} />
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 prose prose-neutral dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-code:before:content-none prose-code:after:content-none max-w-none">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents}
          >
            {activeArticle.content}
          </Markdown>
        </div>
      </div>
    </article>
  )
}
