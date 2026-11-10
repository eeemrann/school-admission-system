import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "../../lib/api/client";

export const classesQueryKey = ["classes"] as const;

export function useClassesQuery() {
  return useQuery({
    queryKey: classesQueryKey,
    queryFn: ({ signal }) => getApiClient().listClasses(signal),
  });
}
