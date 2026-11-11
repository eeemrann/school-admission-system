export interface StudentIdentityResult {
  ok: boolean;
  value?: string;
  error?: string;
}

export function validateStudentId(rawStudentId: string): StudentIdentityResult {
  const value = rawStudentId.trim();
  return /^\d{17}$/.test(value)
    ? { ok: true, value }
    : { ok: false, error: "Enter exactly 17 numeric digits for the birth registration number." };
}

export function validateStudentName(rawStudentName: string): StudentIdentityResult {
  const value = rawStudentName.trim().replace(/\s+/g, " ");
  return value.length >= 2
    ? { ok: true, value }
    : { ok: false, error: "Enter the student's full name." };
}
