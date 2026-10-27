export default async ({ page, shot, dump, loadScene }) => {
  await page.goto("/architecture"); await page.waitForTimeout(2000);
  await shot("arch0"); await dump();
  await loadScene("priya-sap"); console.log(page.url()); await page.waitForTimeout(1500);
  await shot("sap0"); await dump();
};
