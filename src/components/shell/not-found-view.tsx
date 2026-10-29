import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

/** Branded 404. Render from src/app/not-found.tsx. */
export function NotFoundView() {
  return (
    <div className="max-w-xl py-10">
      <EmptyState
        icon={MapPinOff}
        title="Page not found"
        description="The link may be mistyped, or the page has moved."
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
