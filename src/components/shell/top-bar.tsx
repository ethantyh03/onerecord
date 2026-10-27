"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NotificationBell } from "./notification-bell";
import { PersonaSwitcher } from "./persona-switcher";
import { ResetDemoButton } from "./reset-demo-button";
import { SidebarNav } from "./sidebar-nav";
import { SimClock } from "./sim-clock";

export function TopBar() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-card/92 backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger
            className="inline-flex size-10 items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu aria-hidden className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" showCloseButton={false} className="w-[264px] border-r-0 p-0 sm:max-w-[264px]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <PersonaSwitcher />

        <div className="ml-auto flex items-center gap-2">
          <SimClock />
          <NotificationBell />
          <ResetDemoButton />
        </div>
      </div>
    </header>
  );
}
