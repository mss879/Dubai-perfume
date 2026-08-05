"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { SITE_URL } from "../lib/site";

const MEMBER_BENEFITS = [
  "Complimentary discovery samples with every order",
  "Preferred pricing on the full collection",
  "Climate-guarded white glove delivery",
];

/**
 * Where Supabase should send a confirmation link back to.
 *
 * The live origin comes first so a link raised on localhost comes back to
 * localhost; SITE_URL is the fallback for the server render. Whichever is used
 * must be listed under Authentication → URL Configuration → Redirect URLs in
 * the Supabase dashboard, or Supabase silently substitutes the Site URL and the
 * `next` destination is lost.
 */
const confirmRedirect = (destination: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : SITE_URL;
  return `${origin}/auth/callback?next=${encodeURIComponent(destination)}`;
};

/**
 * Supabase speaks in error codes. Left raw, a shopper who had simply not
 * confirmed their address yet was shown the bare string "Email not confirmed"
 * with nothing to do about it.
 */
function friendlyAuthError(error: { message?: string; code?: string }): string {
  const code = error.code || "";
  const message = error.message || "";
  const says = (pattern: RegExp) => pattern.test(message);

  if (code === "email_not_confirmed" || says(/email not confirmed/i)) {
    return "Please confirm your email address first. We sent you a link when you created your account.";
  }
  if (code === "invalid_credentials" || says(/invalid login credentials/i)) {
    return "That email address and password do not match an account.";
  }
  if (code === "user_already_exists" || says(/already registered|already exists/i)) {
    return "An account already exists for this address. Please sign in instead.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || says(/rate limit/i)) {
    return "Too many attempts just now. Please wait a minute and try again.";
  }
  if (code === "weak_password" || says(/password should be at least|password is too short/i)) {
    return "Please choose a password of at least 6 characters.";
  }
  if (code === "email_address_invalid" || says(/email address .*is invalid|unable to validate email/i)) {
    return "Please enter a valid email address.";
  }
  if (code === "signup_disabled") {
    return "New accounts are not being accepted at the moment. Please write to us.";
  }
  return message || "We could not complete that. Please try again.";
}

export default function SigninClient({
  redirectTo,
  notice,
}: {
  redirectTo: string | null;
  notice?: string | null;
}) {
  const router = useRouter();
  // Hydrate the signed-in email synchronously so the first paint is correct.
  const [userEmail, setUserEmail] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("userEmail") : null
  );
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [inputEmail, setInputEmail] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(notice ?? null);
  const [submitting, setSubmitting] = useState(false);
  // Set to the address once a signup needs its email confirming — the account
  // exists but has no session yet, so there is nothing to sign in to.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
  // Offer to resend when a sign-in fails purely because of confirmation.
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);

  const postAuthDestination = redirectTo || "/customer/dashboard";

  // The cookie session is the source of truth — sync the local mirror to it so
  // a shopper whose localStorage was cleared (or who signed in elsewhere) is
  // still recognised.
  //
  // The sync runs BOTH ways. It previously only wrote the mirror when a session
  // existed and never cleared it when one did not, which stranded anyone whose
  // session had expired: this page read the stale email, showed "You are signed
  // in as …", and its "Go to my account" button bounced straight back here.
  useEffect(() => {
    let cancelled = false;
    const syncSession = async () => {
      try {
        const supabase = getBrowserSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user?.email) {
          setUserEmail(user.email);
          localStorage.setItem("userEmail", user.email);
          if (user.id) localStorage.setItem("userId", user.id);
        } else {
          // No session: the mirror is stale. Clear it so the sign-in form is
          // shown rather than a "signed in" screen that leads nowhere.
          setUserEmail(null);
          localStorage.removeItem("userEmail");
          localStorage.removeItem("userId");
          localStorage.removeItem("userRole");
        }
      } catch {
        // Auth unreachable — leave the local hydration alone rather than
        // signing the shopper out over a transient network failure.
      }
    };
    syncSession();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Display-only mirror for pages that want the shopper's email without an
   * async round-trip. The cookie-backed Supabase session is the source of
   * truth; nothing may derive a *privilege* from these entries.
   */
  const persistSession = (email: string, id: string | null) => {
    localStorage.setItem("userEmail", email);
    if (id) localStorage.setItem("userId", id);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inputEmail.trim().toLowerCase();

    if (!email) {
      setErrorMsg("Please fill in your email address.");
      return;
    }
    if (!inputPassword) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setCanResend(false);

    try {
      const supabase = getBrowserSupabase();
      const { data, error } =
        authMode === "signin"
          ? await supabase.auth.signInWithPassword({
              email,
              password: inputPassword,
            })
          : await supabase.auth.signUp({
              email,
              password: inputPassword,
              options: { emailRedirectTo: confirmRedirect(postAuthDestination) },
            });

      if (error) {
        setErrorMsg(friendlyAuthError(error));
        // The account exists and the password was right — only the address is
        // unconfirmed, which a fresh link fixes.
        if (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message || "")) {
          setCanResend(true);
        }
        return;
      }

      if (authMode === "signup") {
        // Supabase does not reveal that an address is taken: it returns a user
        // with an empty `identities` array instead. Reporting that as a new
        // account would send the shopper off to wait for an email that is
        // never coming.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setAuthMode("signin");
          setErrorMsg("An account already exists for this address. Please sign in, or reset your password.");
          return;
        }

        // No session means this project requires email confirmation. The
        // account is real but not yet usable — the previous code read only
        // `data.user`, which IS populated here, so it announced success and
        // redirected a shopper who was not signed in at all.
        if (!data.session) {
          setAwaitingConfirmation(data.user?.email || email);
          setInputPassword("");
          return;
        }
      }

      const session = data.session;
      if (!session?.user) {
        setErrorMsg("We could not sign you in. Please check your details.");
        return;
      }

      persistSession(session.user.email || email, session.user.id ?? null);
      setUserEmail(session.user.email || email);
      setInputPassword("");

      localStorage.setItem(
        "authNotification",
        authMode === "signin"
          ? "Welcome back. You are now signed in."
          : "Account created successfully. Welcome."
      );

      router.push(postAuthDestination);
    } catch (err) {
      console.error("Authentication failed", err);
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Send a fresh confirmation link for an account that exists but is unconfirmed. */
  const handleResendConfirmation = async (address: string) => {
    setResending(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const { error } = await getBrowserSupabase().auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: confirmRedirect(postAuthDestination) },
      });
      if (error) {
        setErrorMsg(friendlyAuthError(error));
        return;
      }
      setInfoMsg("A new confirmation link is on its way. Please check your inbox.");
    } catch (err) {
      console.error("Resend confirmation failed", err);
      setErrorMsg("We could not send the link. Please try again shortly.");
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await getBrowserSupabase().auth.signOut();
    } catch (err) {
      console.error("Sign out failed", err);
    }

    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("userRole");
    setUserEmail(null);
    setInputEmail("");
    setInputPassword("");

    localStorage.setItem("authNotification", "Successfully signed out.");
    router.push("/");
  };

  const tabs: { key: "signin" | "signup"; label: string }[] = [
    { key: "signin", label: "Sign in" },
    { key: "signup", label: "Create an account" },
  ];

  return (
    <div className="maison min-h-screen flex flex-col">
      <AppHeader />

      <main className="flex-grow">
        <div className="maison-container maison-section">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-[420px] mx-auto"
          >
            {awaitingConfirmation ? (
              /* ── Account created, address not yet confirmed ─────── */
              <div className="text-center">
                <span className="maison-eyebrow block">Account</span>
                <h1 className="maison-page-title mt-5">Confirm your email</h1>
                <p className="mt-6 text-[14px] font-light leading-[1.7] text-[#646464]">
                  Your account has been created. We have sent a confirmation link to{" "}
                  <span className="text-black break-all">{awaitingConfirmation}</span>. Please open
                  it to activate your account — you will be signed in automatically.
                </p>

                <div className="mt-10">
                  <hr className="maison-rule" />
                </div>

                {infoMsg && (
                  <p className="mt-10 border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-center text-[12px] uppercase tracking-[0.1em] text-black">
                    {infoMsg}
                  </p>
                )}
                {errorMsg && (
                  <p className="mt-10 border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-center text-[12px] uppercase tracking-[0.1em] text-black">
                    {errorMsg}
                  </p>
                )}

                <p className="mt-10 text-[14px] font-light leading-[1.7] text-[#646464]">
                  Nothing in your inbox? Please check your spam folder.
                </p>

                <div className="mt-8 flex flex-col items-center gap-6">
                  <button
                    type="button"
                    disabled={resending}
                    onClick={() => handleResendConfirmation(awaitingConfirmation)}
                    className="maison-link cursor-pointer text-[#646464] hover:text-black"
                  >
                    {resending ? "Sending" : "Send the link again"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAwaitingConfirmation(null);
                      setAuthMode("signin");
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="maison-link cursor-pointer text-[#646464] hover:text-black"
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            ) : userEmail ? (
              /* ── Already signed in ─────────────────────────────── */
              <div className="text-center">
                <span className="maison-eyebrow block">Account</span>
                <h1 className="maison-page-title mt-5">My account</h1>
                <p className="mt-6 text-[14px] font-light leading-[1.7] text-[#646464] break-all">
                  You are signed in as {userEmail}
                </p>

                <div className="mt-10">
                  <hr className="maison-rule" />
                </div>

                <div className="mt-10 flex flex-col gap-4">
                  <Link href="/customer/dashboard" className="maison-btn w-full">
                    Go to my account
                  </Link>
                  <Link href="/wishlist" className="maison-btn-outline w-full">
                    View my wishlist
                  </Link>
                </div>

                <div className="mt-14 text-left">
                  <span className="maison-eyebrow block">Membership</span>
                  <ul className="mt-6">
                    {MEMBER_BENEFITS.map((benefit) => (
                      <li
                        key={benefit}
                        className="border-t border-[rgba(0,0,0,0.12)] py-4 text-[14px] font-light leading-[1.6] text-[rgba(0,0,0,0.75)] last:border-b last:border-[rgba(0,0,0,0.12)]"
                      >
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-12">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="maison-link cursor-pointer text-[#646464] hover:text-black"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              /* ── Sign in / register ────────────────────────────── */
              <div>
                <header className="text-center">
                  <span className="maison-eyebrow block">Account</span>
                  <h1 className="maison-page-title mt-5">
                    {authMode === "signin" ? "Sign in" : "Create an account"}
                  </h1>
                  <p className="mt-6 mx-auto max-w-[38ch] text-[14px] font-light leading-[1.7] text-[#646464]">
                    {authMode === "signin"
                      ? "Sign in to follow your orders, keep your wishlist and shop faster."
                      : "Create an account to follow your orders and save the fragrances you love."}
                  </p>
                </header>

                {/* Mode switch — text buttons with a 1px active underline */}
                <nav className="mt-10 flex items-center justify-center gap-10">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setAuthMode(tab.key);
                        setErrorMsg(null);
                        setInfoMsg(null);
                        setCanResend(false);
                      }}
                      className={`pb-1.5 text-[15px] uppercase tracking-[0.06em] transition-colors duration-300 cursor-pointer ${
                        authMode === tab.key
                          ? "text-black border-b border-black"
                          : "text-[#646464] border-b border-transparent hover:text-black"
                      }`}
                      style={{ fontWeight: 350 }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>

                <form onSubmit={handleAuthSubmit} className="mt-10 flex flex-col gap-6">
                  {infoMsg && (
                    <p className="border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-center text-[12px] uppercase tracking-[0.1em] text-black">
                      {infoMsg}
                    </p>
                  )}

                  {errorMsg && (
                    <div className="border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-center">
                      <p className="text-[12px] uppercase tracking-[0.1em] text-black">{errorMsg}</p>
                      {canResend && (
                        <button
                          type="button"
                          disabled={resending}
                          onClick={() => handleResendConfirmation(inputEmail.trim().toLowerCase())}
                          className="maison-link mt-3 cursor-pointer text-[#646464] hover:text-black"
                        >
                          {resending ? "Sending" : "Send the link again"}
                        </button>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="signin-email" className="maison-label">
                      Email address
                    </label>
                    <input
                      id="signin-email"
                      type="email"
                      required
                      value={inputEmail}
                      onChange={(e) => {
                        setInputEmail(e.target.value);
                        setErrorMsg(null);
                        setInfoMsg(null);
                        setCanResend(false);
                      }}
                      placeholder="email@example.com"
                      className="maison-input"
                    />
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <label htmlFor="signin-password" className="maison-label">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={inputPassword}
                      onChange={(e) => {
                        setInputPassword(e.target.value);
                        setErrorMsg(null);
                        setInfoMsg(null);
                        setCanResend(false);
                      }}
                      placeholder="••••••••"
                      className="maison-input"
                    />
                  </div>

                  {authMode === "signup" && (
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        required
                        id="terms-agreement"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-none border border-black accent-black cursor-pointer"
                      />
                      <label
                        htmlFor="terms-agreement"
                        className="text-[14px] font-light leading-[1.5] text-[#646464] cursor-pointer"
                      >
                        I agree to the{" "}
                        <Link href="/terms" className="underline underline-offset-2 hover:text-black transition-colors duration-300">
                          terms &amp; conditions
                        </Link>
                      </label>
                    </div>
                  )}

                  <button type="submit" disabled={submitting} className="maison-btn w-full mt-2">
                    {submitting
                      ? authMode === "signin"
                        ? "Signing in"
                        : "Creating account"
                      : authMode === "signin"
                        ? "Sign in"
                        : "Create account"}
                  </button>
                </form>

                <div className="mt-10 flex flex-col items-center gap-6">
                  {authMode === "signin" && (
                    <Link href="/reset-password" className="maison-link text-[#646464] hover:text-black">
                      Forgot your password
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === "signin" ? "signup" : "signin");
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setCanResend(false);
                    }}
                    className="maison-link cursor-pointer text-[#646464] hover:text-black"
                  >
                    {authMode === "signin" ? "Create an account" : "I already have an account"}
                  </button>
                </div>

                <p className="mt-12 text-center text-[12px] uppercase tracking-[0.1em] text-[#646464]">
                  Secure encrypted connection
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
