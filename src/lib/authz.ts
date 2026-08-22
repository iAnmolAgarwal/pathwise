import { currentUser } from "@/auth";
import { getOwnedLearner } from "@/db/queries";
import { jsonError, UuidSchema } from "@/lib/api";
import type { SessionUser } from "@/schemas";

/**
 * Route-level authorisation (§19). Two outcomes only: 401 when nobody is signed in, 404 when
 * the learner is missing or belongs to another user. There is no 403 — an unowned id must
 * look exactly like an unknown one.
 */
export async function requireSession(): Promise<{ ok: true; user: SessionUser } | { ok: false; response: Response }> {
  const user = await currentUser();
  if (!user) return { ok: false, response: jsonError(401, "Sign in to continue") };
  return { ok: true, user };
}

export async function requireLearner(
  learnerId: string,
): Promise<
  | { ok: true; user: SessionUser; learner: NonNullable<Awaited<ReturnType<typeof getOwnedLearner>>> }
  | { ok: false; response: Response }
> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!UuidSchema.safeParse(learnerId).success) return { ok: false, response: jsonError(404, "Learner not found") };
  const learner = await getOwnedLearner(session.user.id, learnerId);
  if (!learner) return { ok: false, response: jsonError(404, "Learner not found") };
  return { ok: true, user: session.user, learner };
}

/** Sign-in URL that brings the visitor back to `returnTo` once Google has answered. */
export function signInUrl(returnTo: string): string {
  return `/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`;
}

/** Only same-origin paths are honoured as a return address; anything else lands on /learn. */
export function safeCallbackUrl(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/learn";
  return raw;
}
