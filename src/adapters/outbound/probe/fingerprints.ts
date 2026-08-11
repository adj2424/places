/**
 * Body substrings that mark a parked / suspended / placeholder page even when
 * the HTTP status is 200. Matched case-insensitively against the response body.
 */
export const PLACEHOLDER_FINGERPRINTS: readonly {
  readonly name: string;
  readonly pattern: RegExp;
}[] = [
  {
    name: "godaddy_parked",
    pattern: /this domain is parked|godaddy[\s\S]{0,40}parked/i,
  },
  {
    name: "sedo_parked",
    pattern: /sedo|buy this domain/i,
  },
  {
    name: "suspended_account",
    pattern: /account has been suspended|suspended account/i,
  },
  {
    name: "coming_soon",
    pattern: /coming soon|website is under construction/i,
  },
  {
    name: "default_page",
    pattern: /apache2 default page|welcome to nginx/i,
  },
];

export function matchFingerprint(body: string): string | null {
  for (const entry of PLACEHOLDER_FINGERPRINTS) {
    if (entry.pattern.test(body)) return entry.name;
  }
  return null;
}
