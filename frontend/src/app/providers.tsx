import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { StudentIdentityProvider } from "../contexts/StudentIdentityContext";
import { createQueryClient } from "./queryClient";

const queryClient = createQueryClient();

export function AppProviders({
  children,
  client = queryClient,
}: {
  children: ReactNode;
  client?: ReturnType<typeof createQueryClient>;
}) {
  return (
    <QueryClientProvider client={client}>
      <StudentIdentityProvider>{children}</StudentIdentityProvider>
    </QueryClientProvider>
  );
}
