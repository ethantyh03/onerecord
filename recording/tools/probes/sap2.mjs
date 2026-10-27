export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("priya-sap"); await page.waitForTimeout(1200);
  await page.getByTestId("mdm-generate-dtw").click(); await page.waitForTimeout(1500);
  await shot("sap1"); await dump("dtw");
  await page.mouse.wheel(0, 400); await page.waitForTimeout(800); await shot("sap2");
  await page.getByTestId("mdm-tab-sl").click(); await page.waitForTimeout(1000); await shot("sap3");
  await page.mouse.wheel(0, 500); await page.waitForTimeout(800); await shot("sap4");
  await page.mouse.wheel(0, -2000); await page.waitForTimeout(800);
  await page.getByTestId("mdm-mark-created").click(); await page.waitForTimeout(400); await shot("br0");
  await page.waitForTimeout(1500); await shot("br1"); await dump("stuck");
  console.log(await page.locator("[data-sonner-toast]").allTextContents());
};
