export interface StudentIdentityResult {
  ok: boolean;
  value?: string;
  error?: string;
}

export function validateStudentId(rawStudentId: string): StudentIdentityResult {
  const value = rawStudentId.trim();
  return value ? { ok: true, value } : { ok: false, error: "Enter a student ID to continue." };
}
