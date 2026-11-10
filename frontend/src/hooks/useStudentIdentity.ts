import { useContext } from "react";
import {
  StudentIdentityContext,
  type StudentIdentityContextValue,
} from "../contexts/studentIdentityContext";

export function useStudentIdentity(): StudentIdentityContextValue {
  const context = useContext(StudentIdentityContext);
  if (!context) {
    throw new Error("useStudentIdentity must be used inside StudentIdentityProvider.");
  }

  return context;
}
