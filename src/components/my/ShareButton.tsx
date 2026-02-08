import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconShare, IconCheck } from "@tabler/icons-react";

interface ShareButtonProps {
  evaluationId: string;
  shareId?: string;
}

export default function ShareButton({
  evaluationId: _evaluationId,
  shareId,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!shareId) return;
    const url = `${window.location.origin}/shared/${shareId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (shareId) {
    return (
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <>
            <IconCheck className="mr-1.5 h-4 w-4" />
            Link copied!
          </>
        ) : (
          <>
            <IconShare className="mr-1.5 h-4 w-4" />
            Copy Link
          </>
        )}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled>
      <IconShare className="mr-1.5 h-4 w-4" />
      Generate Share Link
    </Button>
  );
}
