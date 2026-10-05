import { useState, type FormEvent } from "react";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useTypingSettled } from "../analytics/useTypingSettled.js";
import { useNewOverviewRunController } from "./NewOverviewRunContext.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import { isYouTubeUrl, youTubeLink } from "./util/parseYouTubeUrl.js";
import { usePlaylistApi } from "../playlists/usePlaylistApi.js";

// A pasted link handed to the shell's run, which opens the dialog on the progress it makes:
// one pipeline, wherever the field sits (docs/features/stone-theme.md, "First run").
export function useStartFromLink() {
  const readiness = useGenerationReadiness();
  const controller = useNewOverviewRunController();
  const analytics = useAnalytics();
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const playlistsAvailable = usePlaylistApi() !== null;
  useTypingSettled(url, () =>
    analytics.capture.newOverviewForm.linkEntered({ recognised: isYouTubeUrl(url), from: "home" }),
  );

  const generate = (event: FormEvent) => {
    event.preventDefault();
    const link = youTubeLink(url);
    if (playlistsAvailable && link !== null && link.kind !== "video") {
      setValidationError(null);
      controller.openWith(url);
      setUrl("");
      return;
    }
    if (!isYouTubeUrl(url)) {
      analytics.capture.newOverviewForm.linkRefused({ from: "home" });
      setValidationError("That doesn't look like a YouTube URL.");
      return;
    }
    setValidationError(null);
    controller.start(url, { from: "home" });
    controller.open();
    setUrl("");
  };

  return { readiness, ready: readiness === "ready", url, setUrl, validationError, generate };
}
