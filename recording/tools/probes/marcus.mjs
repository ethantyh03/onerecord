export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("admin-marcus");
  console.log(page.url());
  await shot("mar0"); await dump();
  const btn = page.getByRole("button", { name: /Add business unit/i });
  console.log("addBU count", await btn.count());
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(1000); await shot("mar1"); await dump("bu"); }
  const fill = page.getByRole("button", { name: /Fill demo values/i });
  console.log("fill count", await fill.count());
};
