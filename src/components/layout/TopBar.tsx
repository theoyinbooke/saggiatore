import { Link, useLocation, useNavigate } from "react-router-dom";
import { IconScale, IconArticle } from "@tabler/icons-react";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { ProjectStorySidebar } from "@/components/ProjectStorySidebar";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  ClerkLoaded,
  ClerkLoading,
} from "@clerk/clerk-react";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMyMode =
    location.pathname.startsWith("/my") ||
    location.pathname.startsWith("/shared");

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/95 px-6 py-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <IconScale size={22} className="text-primary" />
        <span className="text-lg font-semibold tracking-tight">
          {isMyMode ? "My Saggiatore" : "Saggiatore"}
        </span>
        <Switch
          checked={isMyMode}
          onCheckedChange={(checked) => navigate(checked ? "/my" : "/")}
          className="ml-1"
        />
      </div>
      <div className="flex items-center gap-4">
        <Link
          to={isMyMode ? "/my/blog" : "/blog"}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconArticle className="h-4 w-4" />
          Blog
        </Link>
        {clerkPubKey && (
          <>
            <ClerkLoading>
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            </ClerkLoading>
            <ClerkLoaded>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </ClerkLoaded>
          </>
        )}
        <Sheet>
          <SheetTrigger asChild>
            <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
              S
            </div>
          </SheetTrigger>
          <SheetContent>
            <ProjectStorySidebar />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
