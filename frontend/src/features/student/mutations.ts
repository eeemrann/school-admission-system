import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "../../lib/api/client";
import { classesQueryKey } from "../classes/queries";
import { holdQueryKey, studentApplicationsQueryKey } from "./queries";

interface StudentMutationVariables {
  studentId: string;
  holdId: string;
}

interface CreateHoldVariables {
  studentId: string;
  classId: string;
}

export function useCreateHoldMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, classId }: CreateHoldVariables) =>
      getApiClient().createHold(classId, studentId),
    onSettled: async (_data, _error, variables) => {
      await invalidateStudentWorkflowQueries(queryClient, variables?.studentId);
    },
  });
}

export function useConfirmHoldMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, holdId }: StudentMutationVariables) =>
      getApiClient().confirmHold(holdId, studentId),
    onSettled: async (_data, _error, variables) => {
      await invalidateStudentWorkflowQueries(queryClient, variables?.studentId, variables?.holdId);
    },
  });
}

export function useCancelHoldMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, holdId }: StudentMutationVariables) =>
      getApiClient().cancelHold(holdId, studentId),
    onSettled: async (_data, _error, variables) => {
      await invalidateStudentWorkflowQueries(queryClient, variables?.studentId, variables?.holdId);
    },
  });
}

async function invalidateStudentWorkflowQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  studentId?: string,
  holdId?: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: classesQueryKey }),
    studentId
      ? queryClient.invalidateQueries({ queryKey: studentApplicationsQueryKey(studentId) })
      : Promise.resolve(),
    holdId ? queryClient.invalidateQueries({ queryKey: holdQueryKey(holdId) }) : Promise.resolve(),
  ]);
}
