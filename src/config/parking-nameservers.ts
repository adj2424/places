/**
 * Nameserver-based parked-domain detection, which is the strongest cheap signal
 * available because it is content-independent: parking pages are routinely
 * served with a success status, so an HTTP status code alone cannot see them.
 */
export const PARKING_NAMESERVER_HOSTS: readonly string[] = [
  // Domain marketplaces
  "dan.com",
  "undeveloped.com",
  "park.do",
  "afternic.com",
  "eftydns.com",
  "squadhelp.com",
  "hugedomains.com",
  "domainmarket.com",
  "brandshelter.com",
  "sav.com",
  "uniregistry.net",
  "namefind.com",
  "buydomains.com",
  // Parking providers
  "sedoparking.com",
  "parkingcrew.net",
  "above.com",
  "bodis.com",
  "cashparking.com",
  "smartname.com",
  "parklogic.com",
  "voodoo.com",
  "dsredirection.com",
  "domainnamesales.com",
  "domainparkingserver.net",
  "parkpage.com",
  "ztomy.com",
  "skenzo.com",
  "namedrive.com",
  "trafficz.com",
];

/**
 * DNS and site-builder hosts that front real websites. Listed explicitly
 * because several are easy to mistake for parking — `domaincontrol.com` is
 * GoDaddy's nameserver and sits in front of a great many live small-business
 * sites, so matching it as parked would discard real customers.
 */
export const BENIGN_NAMESERVER_HOSTS: readonly string[] = [
  "cloudflare.com",
  "domaincontrol.com",
  "squarespace.com",
  "wixdns.net",
  "myshopify.com",
  "vercel-dns.com",
  "nsone.net",
  "hostinger.com",
  "awsdns-01.org",
  "awsdns-02.co.uk",
  "awsdns-03.net",
  "awsdns-04.com",
  "azure-dns.com",
  "googledomains.com",
  "google.com",
  "digitalocean.com",
  "name-services.com",
  "registrar-servers.com",
  "dreamhost.com",
  "bluehost.com",
  "siteground.net",
  "webflow.com",
];

/**
 * Body text that marks a placeholder, suspended, or for-sale page. Matched
 * against normalized lowercase text.
 */
export const PLACEHOLDER_FINGERPRINTS: readonly string[] = [
  "account suspended",
  "this account has been suspended",
  "this domain is parked",
  "domain is parked",
  "parked free",
  "buy this domain",
  "this domain may be for sale",
  "domain for sale",
  "the domain name is for sale",
  "coming soon",
  "under construction",
  "site not published",
  "website coming soon",
  "default web site page",
  "welcome to nginx",
  "apache2 ubuntu default page",
  "apache2 debian default page",
  "it works!",
  "index of /",
  "future home of something quite cool",
  "this site is temporarily unavailable",
  "no website configured at this address",
];
