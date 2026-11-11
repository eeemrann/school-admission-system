import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { validateStudentId, validateStudentName } from "./studentIdentity";
import { StudentIdentityContext } from "./studentIdentityContext";

const STORAGE_KEY = "school-admission.student-id";
const NAME_STORAGE_KEY = "school-admission.student-name";

export function StudentIdentityProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [studentId, setStudentIdState] = useState(readStoredStudentId);
  const [studentName, setStudentNameState] = useState(readStoredStudentName);

  const setStudentId = useCallback(
    (rawStudentId: string) => {
      const result = validateStudentId(rawStudentId);
      if (!result.ok || !result.value) {
        return result;
      }

      if (result.value !== studentId) {
        queryClient.removeQueries({ queryKey: ["student"] });
        setStudentNameState(null);
        removeStoredStudentName();
      }
      setStudentIdState(result.value);
      writeStoredStudentId(result.value);
      return result;
    },
    [queryClient, studentId],
  );

  const setStudentIdentity = useCallback(
    (rawStudentId: string, rawStudentName: string) => {
      const idResult = validateStudentId(rawStudentId);
      if (!idResult.ok || !idResult.value) {
        return idResult;
      }

      const nameResult = validateStudentName(rawStudentName);
      if (!nameResult.ok || !nameResult.value) {
        return nameResult;
      }

      if (idResult.value !== studentId) {
        queryClient.removeQueries({ queryKey: ["student"] });
      }
      setStudentIdState(idResult.value);
      setStudentNameState(nameResult.value);
      writeStoredStudentId(idResult.value);
      writeStoredStudentName(nameResult.value);
      return idResult;
    },
    [queryClient, studentId],
  );

  const clearStudentId = useCallback(() => {
    setStudentIdState(null);
    setStudentNameState(null);
    removeStoredStudentId();
    removeStoredStudentName();
  }, []);

  const value = useMemo(
    () => ({ studentId, studentName, setStudentId, setStudentIdentity, clearStudentId }),
    [clearStudentId, setStudentId, setStudentIdentity, studentId, studentName],
  );

  return (
    <StudentIdentityContext.Provider value={value}>{children}</StudentIdentityContext.Provider>
  );
}

function readStoredStudentId(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)?.trim();
    const result = validateStudentId(value ?? "");
    if (result.ok && result.value) return result.value;
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

function writeStoredStudentId(studentId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, studentId);
  } catch {
    // Local persistence is a convenience; a restricted browser must not break the UI.
  }
}

function readStoredStudentName(): string | null {
  try {
    const value = window.localStorage.getItem(NAME_STORAGE_KEY)?.trim();
    const result = validateStudentName(value ?? "");
    if (result.ok && result.value) return result.value;
    window.localStorage.removeItem(NAME_STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

function writeStoredStudentName(studentName: string): void {
  try {
    window.localStorage.setItem(NAME_STORAGE_KEY, studentName);
  } catch {
    // Local persistence is a convenience; a restricted browser must not break the UI.
  }
}

function removeStoredStudentId(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See writeStoredStudentId: persistence is optional.
  }
}

function removeStoredStudentName(): void {
  try {
    window.localStorage.removeItem(NAME_STORAGE_KEY);
  } catch {
    // See writeStoredStudentName: persistence is optional.
  }
}
