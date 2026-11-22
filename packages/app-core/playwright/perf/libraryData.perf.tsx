import { expect, test } from "@playwright/experimental-ct-react";
import { LibraryDataBench } from "./LibraryDataBench.js";

const SIZES = (process.env.SIZES ?? "500,2000,5000").split(",").map(Number);
const THROTTLE = Number(process.env.THROTTLE ?? 4);

for (const size of SIZES) {
  test(`library data from IndexedDB at ${size} overviews, ${THROTTLE}x CPU`, async ({ mount, page }) => {
    const devtools = await page.context().newCDPSession(page);
    await devtools.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
    await mount(<LibraryDataBench size={size} />);

    await expect(page.getByTestId("LibraryDataBench.status")).toHaveText("done", { timeout: 600_000 });

    const result = await page.evaluate(() => window.__benchResult);
    console.log(`PERF-DATA ${JSON.stringify({ throttle: THROTTLE, ...result })}`);
    expect(result).not.toHaveProperty("error");
  });
}
