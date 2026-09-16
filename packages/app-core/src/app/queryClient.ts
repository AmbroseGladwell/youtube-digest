import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, networkMode: "always", retry: 0 },
    mutations: { networkMode: "always" },
  },
});
