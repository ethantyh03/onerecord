export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("pulse"); await page.waitForTimeout(1500);
  await page.evaluate(()=>window.scrollTo(0, 880)); await page.waitForTimeout(800); await shot("pu1");
  await page.evaluate(()=>window.scrollTo(0, 1900)); await page.waitForTimeout(800); await shot("pu2");
  await page.evaluate(()=>window.scrollTo(0, 2660)); await page.waitForTimeout(800); await shot("pu3");
  await page.getByTestId("pulse-hero-merge").click(); await page.waitForTimeout(500); await shot("pu4");
  await page.waitForTimeout(2500); await shot("pu5"); await dump("hero");
  await page.evaluate(()=>window.scrollTo(0, 3480)); await page.waitForTimeout(800);
  await page.getByTestId("forecast-replay").click(); await page.waitForTimeout(1200); await shot("pu6");
  await page.waitForTimeout(3000); await shot("pu7");
  await page.evaluate(()=>window.scrollTo(0, 5440)); await page.waitForTimeout(800); await shot("pu8");
};
