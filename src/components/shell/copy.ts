/** The environment line under every screen. The live config version is appended where the sandbox has loaded. */
export const FOOTER_TEXT = "Tesseract · Lives Group · Sandbox environment";

/** The one environment tag in the top bar ("Sandbox · synthetic data"): replaces per-section "synthetic data" markers. */
export const ENVIRONMENT_TAG_SHORT = "Sandbox";
export const ENVIRONMENT_TAG_QUALIFIER = "synthetic data";
export const ENVIRONMENT_TAG = `${ENVIRONMENT_TAG_SHORT} · ${ENVIRONMENT_TAG_QUALIFIER}`;
export const ENVIRONMENT_TAG_DETAIL =
  "Sandbox environment. Every customer, item, vendor, order and person here is synthetic, and changes stay in this browser.";

export function footerText(configVersion?: number): string {
  return configVersion ? `${FOOTER_TEXT} · Config v${configVersion}` : FOOTER_TEXT;
}
