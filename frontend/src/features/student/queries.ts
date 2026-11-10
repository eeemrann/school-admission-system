import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "../../lib/api/client";

export function useStudentApplicationsQuery(studentId: string | null) {
  return useQuery({
    queryKey: ["student", "applications", studentId],
    queryFn: ({ signal }) => getApiClient().listMyHolds(studentId ?? "", signal),
    enabled: Boolean(studentId),
  });
}
