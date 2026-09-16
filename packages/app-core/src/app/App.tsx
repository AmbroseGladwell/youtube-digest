import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { StoresProvider, type Stores } from "../stores/StoresContext.js";
import { queryClient } from "./queryClient.js";
import { router } from "./router.js";
import "../theme/global.scss";

export interface AppProps {
  stores: Stores;
}

export function App({ stores }: AppProps) {
  return (
    <StoresProvider value={stores}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StoresProvider>
  );
}
