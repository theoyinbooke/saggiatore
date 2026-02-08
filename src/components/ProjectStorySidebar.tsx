import {
  IconAlertTriangle,
  IconTargetArrow,
  IconRocket,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export function ProjectStorySidebar() {
  return (
    <div className="flex flex-col gap-6 pr-4">
      <SheetHeader>
        <SheetTitle>The Saggiatore Story</SheetTitle>
        <SheetDescription>
          Why this app exists and what it proves for Galileo.
        </SheetDescription>
      </SheetHeader>

      <Separator />

      {/* The Problem */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconAlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-base font-semibold">The Problem</h3>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            Immigration is the highest-stakes domain that AI agent leaderboards
            don't cover. Wrong visa advice can lead to deportation, family
            separation, or permanent inadmissibility.
          </p>
          <p>
            Existing benchmarks have no immigration vertical. AI agents operating
            in this domain need rigorous, domain-specific evaluation — and today
            that evaluation doesn't exist.
          </p>
        </div>
      </section>

      <Separator />

      {/* The Use Case */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconTargetArrow className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">The Use Case</h3>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            Saggiatore evaluates AI immigration agents across{" "}
            <span className="font-medium text-foreground">30 personas</span> in
            5 categories (employment, family, student, humanitarian, special),{" "}
            <span className="font-medium text-foreground">25 scenarios</span>{" "}
            testing 5 capabilities, and{" "}
            <span className="font-medium text-foreground">32 immigration-specific tools</span>.
          </p>
          <p>
            The 5 evaluation capabilities are: Adaptive Tool Use, Scope
            Management, Empathetic Resolution, Extreme Scenario Recovery, and
            Adversarial Input Mitigation.
          </p>
          <p>
            Select a scenario, pick a model, watch the conversation unfold in
            real time, and see Galileo evaluation scores populate live.
          </p>
        </div>
      </section>

      <Separator />

      {/* The Value to Galileo */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconRocket className="h-5 w-5 text-chart-2" />
          <h3 className="text-base font-semibold">The Value to Galileo</h3>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            Proves Galileo's evaluation framework works in life-or-death
            domains — not just chatbots and summarizers.
          </p>
          <p>
            Produces ready-made DevRel artifacts: the app is a tutorial, the
            codebase is a reference integration, and evaluation results are blog
            content.
          </p>
          <p>
            Demonstrates the{" "}
            <span className="font-medium text-foreground">
              Ingest → Analyze → Fix
            </span>{" "}
            pipeline from Galileo's own product literature, live in a browser.
          </p>
          <p>
            Extends the Agent Leaderboard with a vertical that showcases{" "}
            <em>why LLM evaluation matters</em>.
          </p>
        </div>
      </section>
    </div>
  );
}
