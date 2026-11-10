import { createContext } from "react";
import type { StudentIdentityResult } from "./studentIdentity";

export interface StudentIdentityContextValue {
  studentId: string | null;
  setStudentId: (rawStudentId: string) => StudentIdentityResult;
  clearStudentId: () => void;
}

export const StudentIdentityContext = createContext<StudentIdentityContextValue | undefined>(
  undefined,
);
