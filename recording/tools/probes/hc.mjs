export default async ({ page, shot, dump }) => {
  const t0 = Date.now();
  await page.goto("/pitch/hook"); 
  for (const t of [300, 2000, 5000, 9000]) { await page.waitForTimeout(t - (Date.now()-t0) > 0 ? t-(Date.now()-t0) : 0); await shot("hook_"+t); }
  await dump();
  await page.goto("/pitch/close");
  const t1 = Date.now();
  for (const t of [300, 3000, 8000]) { await page.waitForTimeout(Math.max(0, t-(Date.now()-t1))); await shot("close_"+t); }
  await dump();
};
