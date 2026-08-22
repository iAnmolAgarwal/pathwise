import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, signIn } from "@/auth";
import { CenteredPage } from "@/components/learn/CenteredPage";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/ui/orb";
import { safeCallbackUrl } from "@/lib/authz";

export const metadata: Metadata = { title: "Sign in", description: "Sign in with Google to talk to Nova and keep your learning path." };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email is already linked to a different sign-in. Use the account you first signed in with.",
  AccessDenied: "Google did not let us sign you in. Try again, or use another Google account.",
  Configuration: "Sign-in is not configured on this deployment yet.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.4c-.5-1.5-.5-3.2 0-4.7V6.5H1.4c-1.7 3.4-1.7 7.4 0 10.9l3.9-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.7l3.4-3.4C17.9 1.2 15.1 0 12 0 7.4 0 3.4 2.6 1.4 6.5l3.9 3.1c1-2.8 3.6-4.8 6.7-4.8Z" />
    </svg>
  );
}

/** The one door into the app (§19): a Google button, then back to wherever the visitor was going. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(typeof params.callbackUrl === "string" ? params.callbackUrl : undefined);
  const errorCode = typeof params.error === "string" ? params.error : null;
  if (await currentUser()) redirect(callbackUrl);

  async function continueWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    <CenteredPage>
      <div className="mt-10">
        <Orb state="breathing" size={64} label="Nova" />
      </div>
      <h1 className="mt-6 text-[clamp(2.2rem,4vw,3rem)] font-[420] leading-[1.06] tracking-[-0.047em]">
        Sign in to meet <span className="text-gradient-violet">Nova</span>.
      </h1>
      <p className="mt-4 max-w-[38ch] text-lead text-ink-2">
        Your learners, paths and conversations stay with your Google account, so you can pick up on any device.
      </p>
      <form action={continueWithGoogle} className="mt-8 w-full rounded-panel border border-line bg-surface-2 p-5 shadow-float">
        <Button type="submit" size="lg" className="w-full gap-3" data-testid="google-sign-in">
          <GoogleMark /> Continue with Google
        </Button>
        {errorCode && (
          <p className="mt-3 text-[13px] text-coral" role="alert">
            {ERRORS[errorCode] ?? "Sign-in did not go through. Please try again."}
          </p>
        )}
      </form>
      <p className="mt-4 text-[12px] text-ink-3">We only ask Google for your name, email and photo.</p>
    </CenteredPage>
  );
}
