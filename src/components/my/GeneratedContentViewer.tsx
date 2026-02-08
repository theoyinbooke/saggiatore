import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPercent } from "@/lib/utils";
import type { GeneratedConfig } from "@/lib/types";

interface GeneratedContentViewerProps {
  config: GeneratedConfig;
}

export default function GeneratedContentViewer({
  config,
}: GeneratedContentViewerProps) {
  return (
    <Accordion type="multiple" className="w-full">
      {/* Personas */}
      <AccordionItem value="personas">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            Personas
            <Badge variant="secondary">{config.personas.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.personas.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border p-3 space-y-1.5"
              >
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.role}</p>
                <div className="flex flex-wrap gap-1">
                  {p.traits.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Tools */}
      <AccordionItem value="tools">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            Tools
            <Badge variant="secondary">{config.tools.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Params</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.tools.map((t) => (
                <TableRow key={t.name}>
                  <TableCell className="font-medium text-xs">
                    {t.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.category}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {t.parameters.length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionContent>
      </AccordionItem>

      {/* Scenarios */}
      <AccordionItem value="scenarios">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            Scenarios
            <Badge variant="secondary">{config.scenarios.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            {config.scenarios.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{s.title}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {s.category}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {s.complexity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Metrics */}
      <AccordionItem value="metrics">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            Metrics
            <Badge variant="secondary">{config.metrics.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.metrics.map((m) => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium text-xs">
                    {m.displayName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.description}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {formatPercent(m.weight)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionContent>
      </AccordionItem>

      {/* System Prompt */}
      <AccordionItem value="system-prompt">
        <AccordionTrigger>System Prompt</AccordionTrigger>
        <AccordionContent>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{config.agentSystemPrompt}</code>
          </pre>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
