import { SHARE_PAYLOAD_ELEMENT_ID, SharePayload } from "@overview/domain";

// The copy the API inlined in the document. Anything else — no element, unreadable JSON, a
// shape this build does not know — is treated as a link that goes nowhere rather than as a
// crash, because the person holding it can do nothing about either (docs/features/sharing.md).
export function readSharePayload(doc: Document = document): SharePayload {
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
}
