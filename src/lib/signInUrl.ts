/**
 * Sign-in URL helpers. Kept apart from authz.ts, which pulls in Auth.js and the database:
 * client components link to the sign-in page and must not bundle either.
 */

export function signInUrl(returnTo: string): string {
  return `/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`;
}

/** Only same-origin paths are honoured as a return address; anything else lands on /learn. */
export function safeCallbackUrl(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/learn";
  return raw;
}
