import { useCallback, useMemo, useState, type ReactNode } from "react";
import { validateStudentId } from "./studentIdentity";
import { StudentIdentityContext } from "./studentIdentityContext";

const STORAGE_KEY = "school-admission.student-id";

export function StudentIdentityProvider({ children }: { children: ReactNode }) {
  const [studentId, setStudentIdState] = useState(readStoredStudentId);

  const setStudentId = useCallback((rawStudentId: string) => {
    const result = validateStudentId(rawStudentId);
    if (!result.ok || !result.value) {
      return result;
    }

    setStudentIdState(result.value);
    writeStoredStudentId(result.value);
    return result;
  }, []);

  const clearStudentId = useCallback(() => {
    setStudentIdState(null);
    removeStoredStudentId();
  }, []);

  const value = useMemo(
    () => ({ studentId, setStudentId, clearStudentId }),
    [clearStudentId, setStudentId, studentId],
  );

  return (
    <StudentIdentityContext.Provider value={value}>{children}</StudentIdentityContext.Provider>
  );
}

function readStoredStudentId(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)?.trim();
    return value || null;
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

function removeStoredStudentId(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See writeStoredStudentId: persistence is optional.
  }
}
