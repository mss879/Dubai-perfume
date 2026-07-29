"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { clientSafeSupabase } from "../lib/supabase";

const MEMBER_BENEFITS = [
  "Complimentary discovery samples with every order",
  "Preferred pricing on the full collection",
  "Climate-guarded white glove delivery",
];

export default function SignInPage() {
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
  const [submitting, setSubmitting] = useState(false);

  /**
   * The wishlist, dashboard and checkout all key off `userId`, so the identifier
   * returned by the auth call is what gets persisted — never a locally invented one.
   */
  const persistSession = (email: string, id: string | null, isAdmin: boolean) => {
    localStorage.setItem("userEmail", email);
    if (id) localStorage.setItem("userId", id);
    localStorage.setItem("userRole", isAdmin ? "admin" : "customer");
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

    try {
      const { data, error } =
        authMode === "signin"
          ? await clientSafeSupabase.auth.signInWithPassword({
              email,
              password: inputPassword
            })
          : await clientSafeSupabase.auth.signUp({ email, password: inputPassword });

      if (error) {
        setErrorMsg(error.message || "We could not sign you in. Please check your details.");
        return;
      }

      const user = data?.user;
      if (!user) {
        // Supabase returns no session when e-mail confirmation is required.
        setErrorMsg(
          authMode === "signup"
            ? "Check your inbox to confirm your email address, then sign in."
            : "We could not sign you in. Please check your details."
        );
        return;
      }

      persistSession(
        user.email || email,
        user.id ?? null,
        Boolean(user.user_metadata?.is_admin)
      );
      setUserEmail(user.email || email);
      setInputPassword("");

      localStorage.setItem(
        "authNotification",
        authMode === "signin"
          ? "Welcome back. You are now signed in."
          : "Account created successfully. Welcome."
      );

      router.push("/");
    } catch (err) {
      console.error("Authentication failed", err);
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await clientSafeSupabase.auth.signOut();
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
            {userEmail ? (
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
                  {errorMsg && (
                    <p className="border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-center text-[12px] uppercase tracking-[0.1em] text-black">
                      {errorMsg}
                    </p>
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
                        I agree to the terms &amp; conditions
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
                    <Link href="/contact" className="maison-link text-[#646464] hover:text-black">
                      Forgot your password
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === "signin" ? "signup" : "signin");
                      setErrorMsg(null);
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
