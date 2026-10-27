import { OVERLAY } from "../../lib.mjs";
export default async ({ page, shot }) => {
  await page.context().addInitScript(OVERLAY);
  await page.goto("/pitch/hook?still=1"); await page.waitForTimeout(1500);
  console.log(await page.evaluate(() => { window.__recConfig({capLeft:0,capRight:0,capBottom:34,capMax:1000,cursor:false}); window.__recCaption("Hello caption test"); const c=document.getElementById("__rec_cap"); const r=c.getBoundingClientRect(); return JSON.stringify({r, op:getComputedStyle(c).opacity, wrap: getComputedStyle(document.getElementById("__rec_capwrap")).cssText?.slice(0,10), parent: c.parentElement.parentElement.tagName}); }));
  await page.waitForTimeout(300); await shot("ovl");
};
