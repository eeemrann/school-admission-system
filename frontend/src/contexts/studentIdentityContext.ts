import { createContext } from "react";
import type { StudentIdentityResult } from "./studentIdentity";

export interface StudentIdentityContextValue {
  studentId: string | null;
  studentName: string | null;
  setStudentId: (rawStudentId: string) => StudentIdentityResult;
  setStudentIdentity: (rawStudentId: string, rawStudentName: string) => StudentIdentityResult;
  clearStudentId: () => void;
}

export const StudentIdentityContext = createContext<StudentIdentityContextValue | undefined>(
  undefined,
);
