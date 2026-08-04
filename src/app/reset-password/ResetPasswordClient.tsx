"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { SITE_URL } from "../lib/site";

type Mode = "request" | "update";

export default function ResetPasswordClient() {
  // "request" — ask for the email and send the recovery link.
  // "update"  — the shopper is back with a recovery session; set the new password.
  const [mode, setMode] = useState<Mode>("request");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);

  // A recovery link lands back here with a session (supabase-js exchanges the
  // code from the URL on load and emits PASSWORD_RECOVERY). A shopper who is
  // already signed in may also change their password directly.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const supabase = getBrowserSupabase();

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data?.session) setMode("update");
      } catch {
        // No session — stay in request mode.
      }
    })();

    try {
      const { data } = supabase.auth.onAuthStateChange(
        (event: string, session: unknown) => {
          if (event === "PASSWORD_RECOVERY" || session) setMode("update");
        }
      );
      unsubscribe = () => data?.subscription?.unsubscribe();
    } catch {
      // The dev-sandbox mock has no auth events.
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) {
      setErrorMsg("Please fill in your email address.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${SITE_URL}/reset-password`,
      });
      if (error) {
        setErrorMsg(error.message || "We could not send the recovery email. Please try again.");
        return;
      }
      setSuccessMsg(
        "If an account exists for this address, a recovery link is on its way. Please check your inbox."
      );
    } catch (err) {
      console.error("Password recovery request failed", err);
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg("Your new password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setErrorMsg(error.message || "We could not update your password. Please try again.");
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setUpdated(true);
      setSuccessMsg("Your password has been updated.");
    } catch (err) {
      console.error("Password update failed", err);
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
            <header className="text-center">
              <span className="maison-eyebrow block">Account</span>
              <h1 className="maison-page-title mt-5">
                {mode === "request" ? "Reset your password" : "Choose a new password"}
              </h1>
              <p className="mt-6 mx-auto max-w-[38ch] text-[14px] font-light leading-[1.7] text-[#646464]">
                {mode === "request"
                  ? "Enter the email address for your account and we will send you a recovery link."
                  : "Enter a new password for your account below."}
              </p>
            </header>

            <div className="mt-10">
              <hr className="maison-rule" />
            </div>

            {errorMsg && (
              <p className="mt-10 border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-center text-[12px] uppercase tracking-[0.1em] text-black">
                {errorMsg}
              </p>
            )}
            {successMsg && (
              <p className="mt-10 border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-center text-[12px] uppercase tracking-[0.1em] text-black">
                {successMsg}
              </p>
            )}

            {mode === "request" ? (
              <form onSubmit={handleRequest} className="mt-10 flex flex-col gap-6">
                <div>
                  <label htmlFor="reset-email" className="maison-label">
                    Email address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="email@example.com"
                    className="maison-input"
                  />
                </div>

                <button type="submit" disabled={submitting} className="maison-btn w-full mt-2">
                  {submitting ? "Sending" : "Send recovery link"}
                </button>
              </form>
            ) : updated ? (
              <div className="mt-10 text-center">
                <Link href="/customer/dashboard" className="maison-btn w-full">
                  Continue to my account
                </Link>
              </div>
            ) : (
              <form onSubmit={handleUpdate} className="mt-10 flex flex-col gap-6">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="reset-new-password" className="maison-label">
                      New password
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
                    id="reset-new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Minimum 6 characters"
                    className="maison-input"
                  />
                </div>

                <div>
                  <label htmlFor="reset-confirm-password" className="maison-label">
                    Confirm new password
                  </label>
                  <input
                    id="reset-confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="••••••••"
                    className="maison-input"
                  />
                </div>

                <button type="submit" disabled={submitting} className="maison-btn w-full mt-2">
                  {submitting ? "Updating" : "Update password"}
                </button>
              </form>
            )}

            <div className="mt-10 text-center">
              <Link href="/signin" className="maison-link text-[#646464] hover:text-black">
                Back to sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
