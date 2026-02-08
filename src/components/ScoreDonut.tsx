import { PieChart, Pie, Cell } from "recharts";
import { getScoreColor, getScoreLabel, SCORE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ScoreDonutProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_MAP = {
  sm: { width: 56, height: 56, inner: 18, outer: 24, fontSize: 12 },
  md: { width: 100, height: 100, inner: 32, outer: 44, fontSize: 20 },
  lg: { width: 140, height: 140, inner: 46, outer: 62, fontSize: 28 },
};

export function ScoreDonut({ score, size = "md", showLabel = false }: ScoreDonutProps) {
  const dims = SIZE_MAP[size];
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const displayScore = Math.round(score * 100);

  const data = [
    { name: "score", value: score },
    { name: "remainder", value: Math.max(0, 1 - score) },
  ];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dims.width, height: dims.height }}>
        <PieChart width={dims.width} height={dims.height}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={dims.inner}
            outerRadius={dims.outer}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill={SCORE_COLORS.background} />
          </Pie>
        </PieChart>
        {/* Centered score text */}
        <div
          className="absolute inset-0 flex items-center justify-center font-semibold"
          style={{ fontSize: dims.fontSize }}
        >
          {displayScore}
        </div>
      </div>
      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium",
            score > 0.8 ? "text-green-600" : score >= 0.5 ? "text-orange-500" : "text-red-500"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
