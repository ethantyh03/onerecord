export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("weijie-teams");
  await page.waitForTimeout(1200);
  console.log(await page.getByTestId("teams-open-details").evaluate(e=>e.outerHTML.slice(0,300)));
  await page.getByTestId("teams-approve").click(); await page.waitForTimeout(1500);
  await shot("wj1"); await dump("teams"); await dump("waiting");
  await page.goto("/requests/view?id=REQ-1101#request-data"); await page.waitForTimeout(2000);
  await shot("wj2"); await dump();
};
