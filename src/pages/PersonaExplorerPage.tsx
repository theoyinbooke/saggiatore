import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { PersonaCard } from "@/components/PersonaCard";
import { FilterChips, type FilterValue } from "@/components/FilterChips";
import { SearchableFilter } from "@/components/SearchableFilter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { COMPLEXITY_COLORS } from "@/lib/constants";
import type { Persona } from "@/lib/types";

export function PersonaExplorerPage() {
  const rawPersonas = useQuery(api.personas.list);
  const personas: Persona[] = (rawPersonas as Persona[] | undefined) ?? [];

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValue[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);

  // Derive unique filter options from data
  const filterOptions = useMemo(() => {
    const visaTypes = [...new Set(personas.map((p) => p.visaType))].sort();
    const complexities = ["low", "medium", "high"];
    const nationalities = [...new Set(personas.map((p) => p.nationality))].sort();

    return {
      visaType: visaTypes.map((v) => ({ value: v, label: v })),
      complexity: complexities.map((c) => ({
        value: c,
        label: c.charAt(0).toUpperCase() + c.slice(1),
      })),
      nationality: nationalities.map((n) => {
        const flag = personas.find((p) => p.nationality === n)?.countryFlag ?? "";
        return { value: n, label: `${flag} ${n}` };
      }),
    };
  }, [personas]);

  // Display label for filter categories
  const categoryLabelMap: Record<string, string> = {
    visaType: "Visa",
    complexity: "Complexity",
    nationality: "Country",
  };

  // Get selected values for each filter category (using raw category keys)
  const selectedByCategory = useMemo(() => {
    const result: Record<string, string[]> = {
      visaType: [],
      complexity: [],
      nationality: [],
    };
    for (const f of filters) {
      // Reverse-map the display label back to the raw key
      const rawKey = Object.entries(categoryLabelMap).find(
        ([, label]) => label === f.category
      )?.[0];
      if (rawKey && result[rawKey]) {
        result[rawKey].push(f.value);
      }
    }
    return result;
  }, [filters]);

  // Handle filter selection — toggle
  function handleFilterSelect(category: string, value: string) {
    const displayCategory = categoryLabelMap[category] ?? category;
    setFilters((prev) => {
      const existing = prev.find(
        (f) => f.category === displayCategory && f.value === value
      );
      if (existing) {
        return prev.filter((f) => f !== existing);
      }
      return [
        ...prev,
        {
          category: displayCategory,
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1),
        },
      ];
    });
  }

  function handleRemoveFilter(filter: FilterValue) {
    setFilters((prev) => prev.filter((f) => f !== filter));
  }

  // Apply filters and search
  const filteredPersonas = useMemo(() => {
    return personas.filter((p) => {
      // Search filter
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.nationality.toLowerCase().includes(search.toLowerCase()) &&
        !p.visaType.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      // Category filters
      if (
        selectedByCategory.visaType.length > 0 &&
        !selectedByCategory.visaType.includes(p.visaType)
      ) {
        return false;
      }
      if (
        selectedByCategory.complexity.length > 0 &&
        !selectedByCategory.complexity.includes(p.complexityLevel)
      ) {
        return false;
      }
      if (
        selectedByCategory.nationality.length > 0 &&
        !selectedByCategory.nationality.includes(p.nationality)
      ) {
        return false;
      }
      return true;
    });
  }, [personas, search, selectedByCategory]);

  // Stats
  const uniqueCountries = new Set(personas.map((p) => p.nationality)).size;

  return (
    <div>
      <PageHeader
        title="Personas"
        stats={[
          { label: "Total", value: personas.length },
          { label: "Countries", value: uniqueCountries },
          { label: "Showing", value: filteredPersonas.length },
        ]}
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search personas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-9"
          />
        </div>
        <SearchableFilter
          label="Visa Type"
          options={filterOptions.visaType}
          selected={selectedByCategory.visaType}
          onSelect={(v) => handleFilterSelect("visaType", v)}
        />
        <SearchableFilter
          label="Complexity"
          options={filterOptions.complexity}
          selected={selectedByCategory.complexity}
          onSelect={(v) => handleFilterSelect("complexity", v)}
        />
        <SearchableFilter
          label="Country"
          options={filterOptions.nationality}
          selected={selectedByCategory.nationality}
          onSelect={(v) => handleFilterSelect("nationality", v)}
        />
      </div>

      {/* Active filter chips */}
      <div className="mb-6">
        <FilterChips
          filters={filters}
          onRemove={handleRemoveFilter}
          onClearAll={() => setFilters([])}
        />
      </div>

      {/* Card grid */}
      {filteredPersonas.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No personas match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredPersonas.map((persona) => (
            <PersonaCard
              key={persona._id}
              persona={persona}
              onClick={() => setSelectedPersona(persona)}
            />
          ))}
        </div>
      )}

      {/* Persona detail dialog */}
      <PersonaDetailDialog
        persona={selectedPersona}
        open={!!selectedPersona}
        onClose={() => setSelectedPersona(null)}
      />
    </div>
  );
}

// ---- Persona Detail Dialog ----

interface PersonaDetailDialogProps {
  persona: Persona | null;
  open: boolean;
  onClose: () => void;
}

function PersonaDetailDialog({
  persona,
  open,
  onClose,
}: PersonaDetailDialogProps) {
  if (!persona) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{persona.countryFlag}</span>
            <div>
              <DialogTitle className="text-lg">{persona.name}</DialogTitle>
              <DialogDescription>
                {persona.age} &middot; {persona.nationality}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{persona.visaType}</Badge>
          <Badge
            variant="outline"
            className={cn(
              "border text-xs",
              COMPLEXITY_COLORS[persona.complexityLevel]
            )}
          >
            {persona.complexityLevel} complexity
          </Badge>
          <Badge variant="outline" className="text-xs">
            {persona.currentStatus}
          </Badge>
        </div>

        <Separator />

        {/* Backstory */}
        <section>
          <h3 className="mb-1 text-sm font-medium">Backstory</h3>
          <p className="text-sm text-muted-foreground">{persona.backstory}</p>
        </section>

        {/* Goals */}
        <section>
          <h3 className="mb-1 text-sm font-medium">Goals</h3>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
            {persona.goals.map((goal, i) => (
              <li key={i}>{goal}</li>
            ))}
          </ul>
        </section>

        {/* Challenges */}
        <section>
          <h3 className="mb-1 text-sm font-medium">Challenges</h3>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
            {persona.challenges.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>

        {/* Optional info sections */}
        {persona.familyInfo && (
          <section>
            <h3 className="mb-1 text-sm font-medium">Family</h3>
            <p className="text-sm text-muted-foreground">
              {persona.familyInfo}
            </p>
          </section>
        )}

        {persona.employmentInfo && (
          <section>
            <h3 className="mb-1 text-sm font-medium">Employment</h3>
            <p className="text-sm text-muted-foreground">
              {persona.employmentInfo}
            </p>
          </section>
        )}

        {persona.educationInfo && (
          <section>
            <h3 className="mb-1 text-sm font-medium">Education</h3>
            <p className="text-sm text-muted-foreground">
              {persona.educationInfo}
            </p>
          </section>
        )}

        {/* Tags */}
        {persona.tags.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-sm font-medium">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {persona.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs text-muted-foreground"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
