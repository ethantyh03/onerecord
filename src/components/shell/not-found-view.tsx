import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

/** Branded 404 for the prototype. Render from src/app/not-found.tsx. */
export function NotFoundView() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <EmptyState
        icon={MapPinOff}
        title="This page isn't in the prototype"
        description="The link may be mistyped, or it points at something we left out of scope. Pick up the story from one of these."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
              Back to Home
            </Link>
            <Link href="/pulse" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}>
              Regional Pulse
            </Link>
          </div>
        }
      />
    </div>
  );
}
