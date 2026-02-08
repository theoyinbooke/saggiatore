import type { ReactNode } from "react";

interface StatItem {
  label: string;
  value: string | number;
}

interface PageHeaderProps {
  title: string;
  stats?: StatItem[];
  /** Optional element rendered at the right end of the stats row. */
  action?: ReactNode;
}

export function PageHeader({ title, stats, action }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {(stats?.length || action) && (
        <div className="mt-3 flex items-center gap-6 text-sm text-muted-foreground">
          {stats?.map((stat, i) => (
            <span key={i}>
              {stat.label}{" "}
              <span className="font-semibold text-foreground">{stat.value}</span>
            </span>
          ))}
          {action && <div className="ml-auto flex items-center gap-3">{action}</div>}
        </div>
      )}
    </div>
  );
}
