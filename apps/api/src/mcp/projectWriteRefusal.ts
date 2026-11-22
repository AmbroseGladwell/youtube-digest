import { isApiError } from "../http/ApiError.js";
import { toolError, type McpToolOutcome } from "./McpTool.js";

export const projectWriteRefusal = (error: unknown): McpToolOutcome | null => {
  if (!isApiError(error)) {
    return null;
  }
  if (error.code === "record_newer_than_client") {
    return toolError(
      "This project was changed by a newer version of the app than this server knows, so nothing was changed. Try again once the server has updated.",
    );
  }
  if (error.code === "not_found") {
    return toolError("That project was deleted a moment ago, so nothing was changed. list_projects names the projects there are.");
  }
  return null;
};
