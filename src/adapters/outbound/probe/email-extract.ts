const EMAIL_HREF = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
const EMAIL_TEXT =
  /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/;

const REJECT = /example\.com$|sentry\.|wixpress|schema\.org|noreply@|no-reply@/i;

/**
 * First plausible contact email on the page. Prefers mailto links; never
 * invents an address when none is present.
 */
export function extractEmail(html: string): string | null {
  const mailto = html.match(EMAIL_HREF);
  if (mailto?.[1] && !REJECT.test(mailto[1])) {
    return mailto[1].toLowerCase();
  }

  const text = html.match(EMAIL_TEXT);
  if (text?.[1] && !REJECT.test(text[1])) {
    return text[1].toLowerCase();
  }

  return null;
}
