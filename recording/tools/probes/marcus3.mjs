export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("marcus-dup");
  await page.waitForTimeout(1500);
  const f = page.getByTestId("field-customerName");
  await f.click(); await f.press("Control+a"); await f.press("Backspace");
  await page.waitForTimeout(700); await shot("dup1"); await dump("dup");
  await f.pressSequentially("Natl Univ Hosp", { delay: 55 });
  await page.waitForTimeout(1500); await shot("dup2"); await dump("dup");
  await page.getByTestId("dup-choice-extend").click(); await page.waitForTimeout(1500);
  await shot("dup3"); await dump("route");
  await loadScene("weijie-teams"); console.log(page.url());
  await page.waitForTimeout(1500); await shot("wj0"); await dump();
};
