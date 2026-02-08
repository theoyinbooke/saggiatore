import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMPLEXITY_COLORS } from "@/lib/constants";
import type { Persona } from "@/lib/types";

interface PersonaCardProps {
  persona: Persona;
  onClick: () => void;
}

export function PersonaCard({ persona, onClick }: PersonaCardProps) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/30"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{persona.countryFlag}</span>
            <div>
              <CardTitle>{persona.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {persona.age} &middot; {persona.nationality}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-xs border",
              COMPLEXITY_COLORS[persona.complexityLevel]
            )}
          >
            {persona.complexityLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {persona.visaType}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {persona.currentStatus}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {persona.backstory}
        </p>
        {persona.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {persona.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
            {persona.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{persona.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
