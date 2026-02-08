import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconEye, IconEyeOff, IconCheck, IconExternalLink } from "@tabler/icons-react";
import { setGalileoKey } from "@/lib/galileoKey";

const GALILEO_SIGNUP_URL = "https://app.rungalileo.io/sign-up";
const GALILEO_API_KEYS_URL = "https://app.rungalileo.io/settings/api-keys";

interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {number}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-2 text-base font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

interface OnboardingGuideProps {
  onKeySubmitted: () => void;
}

export default function OnboardingGuide({ onKeySubmitted }: OnboardingGuideProps) {
  const [apiKey, setApiKeyLocal] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setGalileoKey(trimmed);
    setSaved(true);
    setTimeout(() => onKeySubmitted(), 1200);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">
          Welcome to My Saggiatore
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          To run your own evaluations you need a Galileo API key. Follow the
          steps below to get set up in a few minutes.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-8 py-8">
          {/* Step 1 */}
          <Step number={1} title="Create a Galileo account">
            <p className="mb-3 text-sm text-muted-foreground">
              Head over to Galileo and sign up for a free account. If you
              already have one, skip to the next step.
            </p>
            <img
              src="/onboarding/step-1-signup.svg"
              alt="Galileo sign-up page"
              className="mb-3 w-full max-w-lg rounded-lg border"
            />
            <Button variant="outline" className="gap-1.5" asChild>
              <a href={GALILEO_SIGNUP_URL} target="_blank" rel="noopener noreferrer">
                Open Galileo Sign Up
                <IconExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </Step>

          {/* Step 2 */}
          <Step number={2} title="Generate an API key">
            <p className="mb-3 text-sm text-muted-foreground">
              Once logged in, go to <strong>Settings &rarr; API Keys</strong> and
              create a new key. Copy it to your clipboard.
            </p>
            <img
              src="/onboarding/step-2-api-key.svg"
              alt="Galileo API keys settings page"
              className="mb-3 w-full max-w-lg rounded-lg border"
            />
            <Button variant="outline" className="gap-1.5" asChild>
              <a href={GALILEO_API_KEYS_URL} target="_blank" rel="noopener noreferrer">
                Open Galileo API Keys
                <IconExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </Step>

          {/* Step 3 */}
          <Step number={3} title="Paste your API key here">
            <p className="mb-3 text-sm text-muted-foreground">
              Paste the key you just copied and hit <strong>Save</strong>. Your
              key is stored locally in your browser and never sent to our
              servers.
            </p>
            <img
              src="/onboarding/step-3-paste-key.svg"
              alt="Paste API key into settings"
              className="mb-3 w-full max-w-lg rounded-lg border"
            />

            {saved ? (
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <IconCheck className="h-5 w-5" />
                API key saved! Redirecting to your dashboard...
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative flex-1 max-w-md">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder="Paste your Galileo API key..."
                    value={apiKey}
                    onChange={(e) => setApiKeyLocal(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? (
                      <IconEyeOff className="h-4 w-4" />
                    ) : (
                      <IconEye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button onClick={handleSave} disabled={!apiKey.trim()}>
                  Save API Key
                </Button>
              </div>
            )}
          </Step>
        </CardContent>
      </Card>
    </div>
  );
}
