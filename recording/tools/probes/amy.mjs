export default async ({ page, shot, dump, loadScene }) => {
  await loadScene("amy-intake");
  await page.getByTestId("paste-example-amy").click();
  await page.waitForTimeout(800);
  await shot("amy1");
  await page.getByTestId("paste-apply").click();
  await page.waitForTimeout(2500);
  await shot("amy2");
  await page.mouse.wheel(0, 450); await page.waitForTimeout(800);
  await shot("amy3");
  await dump();
};
