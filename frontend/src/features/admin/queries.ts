import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "../../lib/api/client";
import type { CreateClassRequest } from "../../types/api";
import { classesQueryKey, classQueryKey } from "../classes/queries";

// Keep one cache for the public class catalogue and administrator views. The API
// owns the counters, so a student reservation can invalidate administrator data.
export const adminClassesQueryKey = classesQueryKey;
export const adminClassQueryKey = classQueryKey;

export function useAdminClassesQuery() {
  return useQuery({
    queryKey: adminClassesQueryKey,
    queryFn: ({ signal }) => getApiClient().listClasses(signal),
    refetchInterval: 10_000,
  });
}

export function useAdminClassQuery(classId: string, enabled = true) {
  return useQuery({
    queryKey: adminClassQueryKey(classId),
    queryFn: ({ signal }) => getApiClient().getClass(classId, signal),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useCreateClassMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateClassRequest) => getApiClient().createClass(request),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminClassesQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["class"] }),
      ]);
    },
  });
}
