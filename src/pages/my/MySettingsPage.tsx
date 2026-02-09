import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconEye, IconEyeOff, IconPencil } from "@tabler/icons-react";
import { getGalileoKey, setGalileoKey, clearGalileoKey } from "@/lib/galileoKey";
import { useUser } from "@clerk/clerk-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function MySettingsPage() {
  const { user } = useUser();
  const [apiKey, setApiKey] = useState(getGalileoKey() ?? "");
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const hasSavedKey = !!getGalileoKey();
  const [isEditing, setIsEditing] = useState(!hasSavedKey);
  const [showClearAll, setShowClearAll] = useState(false);

  function handleSave() {
    if (apiKey.trim()) {
      setGalileoKey(apiKey.trim());
      setSaved(true);
      setIsEditing(false);
      setShowKey(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function handleClear() {
    clearGalileoKey();
    setApiKey("");
    setIsEditing(true);
  }

  function handleClearAllData() {
    setShowClearAll(true);
  }

  function handleConfirmClearAll() {
    localStorage.clear();
    window.location.href = "/my";
  }

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="space-y-4">
        {/* Galileo API Key */}
        <Card>
          <CardHeader>
            <CardTitle>Galileo API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="settings-galileo-key">API Key</Label>
              {isEditing ? (
                <div className="relative">
                  <Input
                    id="settings-galileo-key"
                    type={showKey ? "text" : "password"}
                    placeholder="Enter your Galileo API key..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-9"
                    autoFocus
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
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex h-9 flex-1 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                    {"•".repeat(40)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={!apiKey.trim()}>
                  {saved ? "Saved" : "Save"}
                </Button>
                {hasSavedKey && (
                  <Button variant="outline" onClick={() => { setApiKey(getGalileoKey() ?? ""); setIsEditing(false); setShowKey(false); }}>
                    Cancel
                  </Button>
                )}
                <Button variant="outline" onClick={handleClear}>
                  Clear
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {saved ? "Saved" : "API key is configured"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* User Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Your Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress ?? "No email"}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {user?.id ?? "Not signed in"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clear All My Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              This will remove your user ID, API keys, and all local
              preferences.
            </p>
            <Button variant="destructive" onClick={handleClearAllData}>
              Clear All My Data
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showClearAll}
        onOpenChange={setShowClearAll}
        onConfirm={handleConfirmClearAll}
        title="Clear All Data"
        description="This will permanently remove your user ID, API keys, and all local preferences."
        confirmText="Clear All"
        variant="destructive"
      />
    </div>
  );
}
