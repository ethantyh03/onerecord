export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("marcus-dup");
  await page.waitForTimeout(1200);
  await page.getByTestId("dup-choice-extend").click(); await page.waitForTimeout(1200);
  await dump("field-");
  const pt = page.getByTestId("field-paymentTerms");
  if (await pt.count()) { console.log(await pt.evaluate(e=>e.outerHTML.slice(0,600))); }
};
