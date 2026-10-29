"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SIM_BASE_ISO, useSandbox } from "@/lib/store";
import { formatSgtDateTime } from "@/components/common/format";
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
    toast.success("Sandbox reset", { description: "Every request, approval and SAP record is back to the starting data." });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="lg" className="h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground" />}
      >
        <RotateCcw aria-hidden className="size-4" />
        <span className="hidden 2xl:inline">Reset sandbox</span>
        <span className="sr-only 2xl:hidden">Reset sandbox</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset the sandbox?</DialogTitle>
          <DialogDescription>
            Requests, approvals, notifications, the audit trail and SAP B1 records go back to the starting data,
            and the sandbox clock returns to {formatSgtDateTime(SIM_BASE_ISO)} SGT. Only this browser is affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep my changes</DialogClose>
          <Button variant="destructive" onClick={reset}>
            <RotateCcw aria-hidden className="size-4" />
            Reset sandbox
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
