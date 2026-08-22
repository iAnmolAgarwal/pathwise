import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { accounts, db, sessions, users, verificationTokens } from "@/db";
import { SessionUserSchema } from "@/schemas";

/**
 * Sign in with Google (§19, D-26). Auth.js with database sessions: the browser holds an
 * opaque session token, the `sessions` table holds who it belongs to. Scopes are the
 * OpenID defaults (openid, email, profile) — nothing that needs Google's verification
 * review. `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` come from the environment.
 */
// A config factory, not an object: the database connection opens on the first request,
// never at import time, so builds and tests run without DATABASE_URL.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(db(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    // Expose the user id so routes can check learner ownership against it.
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
}));

/** Validated shape of the signed-in user, or null. Routes and pages go through this. */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const parsed = SessionUserSchema.safeParse({
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  });
  return parsed.success ? parsed.data : null;
}
