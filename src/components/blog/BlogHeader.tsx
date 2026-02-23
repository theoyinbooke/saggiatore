import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { IconCalendar, IconClock } from "@tabler/icons-react"

interface BlogHeaderProps {
  content: string
  title?: string
  subtitle?: string
  badgeLabel?: string
  author?: string
  dateLabel?: string
}

export function BlogHeader({
  content,
  title = "Building an Immigration Agent Leaderboard with Galileo Evaluate",
  subtitle = "A deep dive into building an evaluation platform for immigration AI agents — from persona simulation to real-time scoring with Galileo.",
  badgeLabel = "Technical Blog",
  author = "Olanrewaju Oyinbooke",
  dateLabel = "February 2026",
}: BlogHeaderProps) {
  const stripped = content.replace(/```[\s\S]*?```/g, "")
  const words = stripped.split(/\s+/).filter(Boolean)
  const readingTime = Math.max(1, Math.ceil(words.length / 238))

  return (
    <header className="pb-2">
      <Badge variant="secondary">{badgeLabel}</Badge>
      <h1 className="mt-3 text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
        {title}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl">
        {subtitle}
      </p>
      <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{author}</span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1">
          <IconCalendar className="h-3.5 w-3.5" />
          {dateLabel}
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1">
          <IconClock className="h-3.5 w-3.5" />
          {readingTime} min read
        </span>
      </div>
      <Separator className="my-6" />
    </header>
  )
}
