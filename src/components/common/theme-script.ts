/**
 * Console theme: dark "cold-chain slate" by default, light as the bright-room fallback.
 * The choice is stored per browser under THEME_STORAGE_KEY and applied by THEME_INIT_SCRIPT in the
 * root layout's <head>, before first paint, so there is never a light/dark flash.
 *
 * This file has no React imports so the (server) root layout can inline the script.
 */
export type ConsoleTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "or-theme";

/** True for the recorded /pitch/* frames, which always render light. */
export const PITCH_PATH_TEST = "p==='/pitch'||p.indexOf('/pitch/')===0";

export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,p=location.pathname,t=null;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(${PITCH_PATH_TEST}||t==='light'){d.classList.remove('dark');d.style.colorScheme='light'}else{d.classList.add('dark');d.style.colorScheme='dark'}}catch(e){}})();`;
