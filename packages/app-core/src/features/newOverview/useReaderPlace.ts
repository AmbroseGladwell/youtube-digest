import { useSurface } from "../../app/SurfaceContext.js";
import { useIsPhone } from "../../util/useIsPhone.js";
import type { ReaderPlace } from "./util/pastedLinkFailureCopy.js";

export const useReaderPlace = (): ReaderPlace => {
  const surface = useSurface();
  const phone = useIsPhone();
  if (surface === "extension") {
    return "extension";
  }
  return phone ? "phone" : "computer";
};
