import { useSurface } from "../../app/SurfaceContext.js";
import { useIsPhone } from "../../util/useIsPhone.js";
import type { ReaderPlace } from "./util/pastedLinkFailureCopy.js";

export function useReaderPlace(): ReaderPlace {
  const surface = useSurface();
  const phone = useIsPhone();
  return surface === "extension" ? "extension" : phone ? "phone" : "computer";
}
