import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "../../lib/api/client";

export const classesQueryKey = ["classes"] as const;

export const classQueryKey = (classId: string) => ["class", classId] as const;

export function useClassesQuery() {
  return useQuery({
    queryKey: classesQueryKey,
    queryFn: ({ signal }) => getApiClient().listClasses(signal),
    refetchInterval: 5_000,
  });
}

export function useClassQuery(classId: string, enabled = true) {
  return useQuery({
    queryKey: classQueryKey(classId),
    queryFn: ({ signal }) => getApiClient().getClass(classId, signal),
    enabled,
  });
}
