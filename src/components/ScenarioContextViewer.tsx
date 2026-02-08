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
import {
  METRIC_KEYS,
  METRIC_DISPLAY_NAMES,
  METRIC_DESCRIPTIONS,
  COMPLEXITY_COLORS,
  AGENT_SYSTEM_PROMPT,
} from "@/lib/constants";
import type { Scenario, Persona, Tool } from "@/lib/types";

interface ScenarioContextViewerProps {
  scenario: Scenario;
  persona: Persona | null;
  tools: Tool[];
}

export function ScenarioContextViewer({
  scenario,
  persona,
  tools,
}: ScenarioContextViewerProps) {
  const matchedTools = tools.filter((t) =>
    scenario.expectedTools.includes(t.name)
  );

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-lg font-semibold">Scenario Context</h3>
      <Accordion type="multiple" className="w-full">
        {/* Persona */}
        <AccordionItem value="persona">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              Persona
              <Badge variant="secondary">1</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {persona ? (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {persona.countryFlag} {persona.name}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Age {persona.age} &middot; {persona.nationality}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {persona.currentStatus}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {persona.visaType}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${COMPLEXITY_COLORS[persona.complexityLevel] ?? ""}`}
                  >
                    {persona.complexityLevel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {persona.backstory}
                </p>
                {persona.goals.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Goals</p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                      {persona.goals.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {persona.challenges.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Challenges</p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                      {persona.challenges.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {persona.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Persona data unavailable.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Tools */}
        <AccordionItem value="tools">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              Tools
              <Badge variant="secondary">{matchedTools.length || scenario.expectedTools.length}</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {matchedTools.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Params</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedTools.map((t) => (
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
            ) : (
              <div className="flex flex-wrap gap-1">
                {scenario.expectedTools.map((name) => (
                  <Badge key={name} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Metrics */}
        <AccordionItem value="metrics">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              Metrics
              <Badge variant="secondary">5</Badge>
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
                {METRIC_KEYS.map((key) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium text-xs">
                      {METRIC_DISPLAY_NAMES[key]}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {METRIC_DESCRIPTIONS[key]}
                    </TableCell>
                    <TableCell className="text-right text-xs">20%</TableCell>
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
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap">
              <code>{AGENT_SYSTEM_PROMPT}</code>
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
