import { getScoreColor, SCORE_COLORS } from "@/lib/constants";

interface ScoreRingProps {
  score: number;
}

export function ScoreRing({ score }: ScoreRingProps) {
  const pct = Math.round(score * 100);
  const deg = score * 360;
  const color = getScoreColor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 30, height: 30 }}>
      {/* Ring layer — masked, no children */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${deg}deg, ${SCORE_COLORS.background} ${deg}deg)`,
          WebkitMask: "radial-gradient(farthest-side, transparent 60%, #000 61%)",
          mask: "radial-gradient(farthest-side, transparent 60%, #000 61%)",
        }}
      />
      {/* Score text — sits above the ring, not affected by mask */}
      <span className="relative text-[8px] font-bold leading-none">{pct}</span>
    </div>
  );
}
