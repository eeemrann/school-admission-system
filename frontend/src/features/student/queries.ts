import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "../../lib/api/client";

export const studentApplicationsQueryKey = (studentId: string | null) =>
  ["student", "applications", studentId] as const;

export const holdQueryKey = (holdId: string) => ["hold", holdId] as const;

export function useStudentApplicationsQuery(studentId: string | null) {
  return useQuery({
    queryKey: studentApplicationsQueryKey(studentId),
    queryFn: ({ signal }) => getApiClient().listMyHolds(studentId ?? "", signal),
    enabled: Boolean(studentId),
  });
}

export function useHoldQuery(holdId: string, enabled = true) {
  return useQuery({
    queryKey: holdQueryKey(holdId),
    queryFn: ({ signal }) => getApiClient().getHold(holdId, signal),
    enabled,
    staleTime: 0,
  });
}
