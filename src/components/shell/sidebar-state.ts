/**
 * Where the console rail lives, and how it moves.
 *
 * Home gives its hero (and the full-width wordmark) the whole screen, so the rail is an overlay drawer
 * there and always starts hidden. Every other page docks the rail beside the content on wide screens;
 * ☰ collapses it and the choice is remembered per browser. Below Tailwind's lg breakpoint the rail is a
 * drawer on every page. No React here, so the rules are unit-tested on their own.
 */
export type SidebarPref = "expanded" | "collapsed";
export type SidebarMode = "docked" | "overlay";

/** localStorage key for the docked rail's expanded/collapsed choice (never read on Home). */
export const SIDEBAR_STORAGE_KEY = "or-sidebar";

/** Tailwind's lg breakpoint (64rem): the rail docks from this width up. */
export const SIDEBAR_DOCK_QUERY = "(min-width: 64rem)";

/** The <aside> that ☰ controls (aria-controls). */
export const SIDEBAR_ID = "app-sidebar";

/**
 * One slide for everything the rail moves (the drawer, the docked collapse, the drawer's ☰ slot, the
 * backdrop): 200 ms, decelerating, and nothing under reduced motion. Visibility flips at once when
 * showing (so focus can land) and only after the slide when hiding (so the slide-out is seen).
 */
export const SLIDE_SHOW =
  "[transition:translate_200ms_cubic-bezier(0.2,0,0,1),width_200ms_cubic-bezier(0.2,0,0,1),padding_200ms_cubic-bezier(0.2,0,0,1),opacity_200ms_linear,visibility_0s] motion-reduce:transition-none";
export const SLIDE_HIDE =
  "[transition:translate_200ms_cubic-bezier(0.2,0,0,1),width_200ms_cubic-bezier(0.2,0,0,1),padding_200ms_cubic-bezier(0.2,0,0,1),opacity_200ms_linear,visibility_0s_linear_200ms] motion-reduce:transition-none";

/** Docked beside the content (wide screens, every page but Home) or an overlay drawer. */
export function sidebarMode(pathname: string, wide: boolean): SidebarMode {
  return wide && pathname !== "/" ? "docked" : "overlay";
}

export function parseSidebarPref(raw: string | null | undefined): SidebarPref {
  return raw === "collapsed" ? "collapsed" : "expanded";
}

/** The saved docked choice; expanded when storage is empty, blocked or unavailable. */
export function readSidebarPref(): SidebarPref {
  try {
    return parseSidebarPref(window.localStorage.getItem(SIDEBAR_STORAGE_KEY));
  } catch {
    return "expanded";
  }
}

export function writeSidebarPref(pref: SidebarPref): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, pref);
  } catch {
    // Storage blocked (private window, policy): the choice lasts until the page reloads.
  }
}

/**
 * Whether choosing `href` from the open drawer lands on a page that docks the rail. If so the drawer
 * stays where it is and becomes the docked rail when the page changes, instead of closing and sliding
 * straight back in.
 */
export function linkDocksRail(href: string, currentPath: string, wide: boolean, pref: SidebarPref): boolean {
  return href !== currentPath && sidebarMode(href, wide) === "docked" && pref === "expanded";
}
