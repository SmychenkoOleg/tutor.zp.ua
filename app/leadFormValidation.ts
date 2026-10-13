/** Client-side rules match the public API's two-word name and UA phone checks. */
const UA_MOBILE_CODES = new Set([
  "039", "050", "063", "066", "067", "068", "073", "075", "077", "089",
  "091", "092", "093", "094", "095", "096", "097", "098", "099",
]);
const NAME_PATTERN = /^\p{L}{1,50} \p{L}{1,50}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export type LeadField = "name" | "phone" | "email";
export type LeadFormValues = Record<LeadField, string>;
export type LeadFormErrors = Partial<Record<LeadField, string>>;

export function nameHasOnlyAllowedCharacters(value: string): boolean {
  return /^[\p{L} ]*$/u.test(value);
}

export function digitsOfUkrainianPhone(value: string): string {
  return value.replace(/\D/g, "").replace(/^38/, "").slice(0, 10);
}

export function formatUkrainianPhone(value: string): string {
  const digits = digitsOfUkrainianPhone(value);
  if (!digits) return "";
  let result = "(" + digits.slice(0, 3);
  if (digits.length >= 3) result += ")";
  if (digits.length > 3) result += " " + digits.slice(3, 6);
  if (digits.length > 6) result += "-" + digits.slice(6, 8);
  if (digits.length > 8) result += "-" + digits.slice(8, 10);
  return result;
}

export function validateLeadField(field: LeadField, value: string): string {
  if (field === "name") {
    if (!value.trim()) return "Вкажіть ваше ім'я та прізвище.";
    if (!NAME_PATTERN.test(value.trim())) return "Введіть рівно два слова — ім'я та прізвище, лише літерами.";
    return "";
  }
  if (field === "phone") {
    const rawDigits = value.replace(/\D/g, "").replace(/^38/, "");
    if (rawDigits.length !== 10 || !UA_MOBILE_CODES.has(rawDigits.slice(0, 3))) {
      return "Вкажіть дійсний український номер.";
    }
    return "";
  }
  if (!value.trim() || value.length > 254 || !EMAIL_PATTERN.test(value.trim())) {
    return "Вкажіть дійсний e-mail.";
  }
  return "";
}

export function validateLeadForm(values: LeadFormValues): LeadFormErrors {
  const errors: LeadFormErrors = {};
  for (const field of ["name", "phone", "email"] as const) {
    const error = validateLeadField(field, values[field]);
    if (error) errors[field] = error;
  }
  return errors;
}
