import { useLocation, useNavigate } from "react-router-dom";
import {
  IconTrophy,
  IconUsers,
  IconPlayerPlay,
  IconChartBar,
  IconSettings,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/useAuth";

const navItems = [
  { path: "/", icon: IconTrophy, label: "Leaderboard", adminOnly: false },
  { path: "/personas", icon: IconUsers, label: "Personas", adminOnly: false },
  { path: "/runner", icon: IconPlayerPlay, label: "Runner", adminOnly: true },
  { path: "/results", icon: IconChartBar, label: "Results", adminOnly: false },
  { path: "/settings", icon: IconSettings, label: "Settings", adminOnly: true },
];

export function BottomDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-full border border-border bg-white px-2 py-2 shadow-sm">
          {visibleItems.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </nav>
    </TooltipProvider>
  );
}
