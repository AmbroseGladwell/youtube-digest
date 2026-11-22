import { SHARE_PAYLOAD_ELEMENT_ID, SharePayload } from "@overview/domain";

// Anything unreadable is a link that goes nowhere, not a crash: its holder can do nothing about it.
export const readSharePayload = (doc: Document = document): SharePayload => {
  const element = doc.getElementById(SHARE_PAYLOAD_ELEMENT_ID);
  if (element === null) {
    return { state: "unknown" };
  }
  try {
    const parsed = SharePayload.safeParse(JSON.parse(element.textContent ?? ""));
    return parsed.success ? parsed.data : { state: "unknown" };
  } catch {
    return { state: "unknown" };
  }
};
