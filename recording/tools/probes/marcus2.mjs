export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("admin-marcus");
  await page.getByTestId("admin-add-bu").click(); await page.waitForTimeout(800);
  await page.getByTestId("bu-save").click(); await page.waitForTimeout(1500);
  await shot("mar2"); await dump("config-version");
  await loadScene("marcus-dup");
  console.log(page.url());
  await page.waitForTimeout(2500);
  await shot("dup0"); await dump();
};
