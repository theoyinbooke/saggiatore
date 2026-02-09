import { useLocation, useNavigate } from "react-router-dom";
import {
  IconLayoutDashboard,
  IconPlus,
  IconSettings,
  IconArticle,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/my", icon: IconLayoutDashboard, label: "Evaluations" },
  { path: "/my/create", icon: IconPlus, label: "Create" },
  { path: "/my/blog", icon: IconArticle, label: "Blog" },
  { path: "/my/settings", icon: IconSettings, label: "Settings" },
];

interface MyBottomDockProps {
  onCreateClick?: () => void;
}

export default function MyBottomDock({ onCreateClick }: MyBottomDockProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-full border border-border bg-white px-2 py-2 shadow-sm">
          {navItems.map((item) => {
            const isActive =
              item.path === "/my"
                ? location.pathname === "/my"
                : location.pathname.startsWith(item.path);

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      item.path === "/my/create"
                        ? onCreateClick?.()
                        : navigate(item.path)
                    }
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
