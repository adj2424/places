/**
 * What a website probe observed. This is the domain's input vocabulary for
 * classification, which is why it lives here rather than beside the port: the
 * qualification rules must not depend on the application layer.
 *
 * A confirmed absence and an unanswered lookup are deliberately different
 * variants. Collapsing them would let a DNS timeout be reported as a dead
 * domain, which puts working businesses at the top of the call list.
 */
export type DnsOutcome =
  | { readonly kind: "resolved"; readonly nameservers: readonly string[] }
  | { readonly kind: "no_record" }
  | { readonly kind: "transport_failure"; readonly detail: string };

export type HttpOutcome =
  | {
      readonly kind: "responded";
      readonly status: number;
      readonly finalUrl: string;
      readonly matchedFingerprint: string | null;
      readonly bodyBytes: number;
      readonly hasMobileViewport: boolean;
      readonly responseTimeMs: number;
    }
  | { readonly kind: "transport_failure"; readonly detail: string };

export interface ProbeEvidence {
  readonly url: string;
  readonly dns: DnsOutcome;
  /** Null when the DNS outcome made a fetch pointless. */
  readonly http: HttpOutcome | null;
  readonly email: string | null;
}
