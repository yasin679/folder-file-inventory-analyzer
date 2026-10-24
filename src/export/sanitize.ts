/**
 * Spreadsheet formula-injection protection (OWASP "CSV injection").
 * Text beginning with = + - @ TAB or CR is prefixed with a single quote so that
 * spreadsheet apps treat it as text, never as a formula.
 */
const DANGEROUS = /^[=+\-@\t\r]/;
export function neutralize(v: string): string {
  return DANGEROUS.test(v) ? `'${v}` : v;
}
export const isDangerous = (v: string) => DANGEROUS.test(v);
