import { createContext, useContext } from "react";

// Whether this build may be pointed at a server other than the one it was built for. An
// extension loaded unpacked has to be able to say http://localhost:3000
// (docs/architecture/deploy.md, "The extension"); one installed from the Web Store has no
// use for the field, and a reviewer reading a sign-in page has no idea what it is for.
// True by default, so only a shell that knows it is a store build turns it off.
const ServerSwitchableContext = createContext<boolean>(true);

export const ServerSwitchableProvider = ServerSwitchableContext.Provider;

export function useServerSwitchable(): boolean {
  return useContext(ServerSwitchableContext);
}
