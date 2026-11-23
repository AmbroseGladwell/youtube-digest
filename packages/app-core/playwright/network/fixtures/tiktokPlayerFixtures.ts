import type { Page } from "@playwright/test";

// A stand-in for TikTok's v1 embed: it speaks the same messages and writes each command it hears on its page.
const answeringPlayer = (
  failWith: number | null,
) => `<!doctype html><html><body style="margin:0;background:#1d2530;color:#fff;font:12px sans-serif">
<p id="heard"></p>
<script>
let at = 0;
const length = 58;
const post = (type, value) => parent.postMessage({ "x-tiktok-player": true, type, value }, "*");
const heard = document.getElementById("heard");
window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message["x-tiktok-player"] !== true) return;
  heard.textContent += (heard.textContent ? " " : "") + message.type + (message.value === undefined ? "" : ":" + message.value);
  if (message.type === "seekTo") { at = message.value; post("onCurrentTime", { currentTime: at, duration: length }); }
  if (message.type === "play") { post("onStateChange", 1); post("onCurrentTime", { currentTime: at, duration: length }); }
  if (message.type === "pause") { post("onStateChange", 2); }
});
${failWith === null ? 'post("onPlayerReady");' : `post("onPlayerError", { errorCode: ${failWith}, errorType: "SERVER_ERROR" });`}
</script></body></html>`;

export const routeTikTokPlayer = async (page: Page, { failWith = null }: { failWith?: number | null } = {}): Promise<void> => {
  await page.route("https://www.tiktok.com/player/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: answeringPlayer(failWith) }),
  );
};
