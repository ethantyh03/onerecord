"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useSandbox } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Reseeds this browser's sandbox after an explicit confirmation. */
export function ResetDemoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function reset() {
    useSandbox.getState().resetSandbox();
    setOpen(false);
    router.push("/");
    toast.success("Demo reset", { description: "Every request, approval and SAP record is back to the starting scenario." });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="lg" className="h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground" />}
      >
        <RotateCcw aria-hidden className="size-4" />
        <span className="hidden xl:inline">Reset demo</span>
        <span className="sr-only xl:hidden">Reset demo</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset the demo?</DialogTitle>
          <DialogDescription>
            Requests, approvals, notifications, the audit trail and SAP B1 records go back to the starting scenario,
            and the clock returns to now. Only this browser is affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep my changes</DialogClose>
          <Button variant="destructive" onClick={reset}>
            <RotateCcw aria-hidden className="size-4" />
            Reset demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
