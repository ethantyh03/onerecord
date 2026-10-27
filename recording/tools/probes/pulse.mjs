export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("pulse"); console.log(page.url()); await page.waitForTimeout(2000);
  await shot("pu0"); await dump();
  console.log(await page.evaluate(()=>document.documentElement.scrollHeight));
};
