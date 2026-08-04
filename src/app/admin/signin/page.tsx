"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { getBrowserSupabase } from "../../lib/supabase-browser";

/**
 * `customers.is_admin` is the only thing that grants access. Email substrings
 * and `user_metadata.is_admin` are client-forgeable and are no longer trusted;
 * the server re-checks the same column in src/app/lib/auth.ts before any admin
 * markup is rendered, and RLS enforces it on every query.
 */
async function isVerifiedAdmin(userId: string): Promise<boolean> {
  const { data, error } = await getBrowserSupabase()
    .from("customers")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) return false;
  return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
}

function AdminSignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Already signed in as a verified admin? Skip the form.
    const checkActiveAdmin = async () => {
      const { data: { user } } = await getBrowserSupabase().auth.getUser();
      if (user && (await isVerifiedAdmin(user.id))) {
        router.replace(redirectTo);
      }
    };
    checkActiveAdmin();
  }, [router, redirectTo]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = getBrowserSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const user = data?.user;
      const isAdmin = user ? await isVerifiedAdmin(user.id) : false;

      if (!isAdmin) {
        // Strict isolation: non-admins are blocked and immediately signed out
        await supabase.auth.signOut();
        setErrorMsg("ACCESS DENIED: The credentials provided do not have administrator clearance.");
        setLoading(false);
        return;
      }

      // Success. refresh() lets the server layout observe the new session cookie.
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setErrorMsg("An error occurred during authentication. Please check network configurations.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070301] text-white flex flex-col justify-between font-sans-luxury overflow-hidden p-6 md:p-12">
      
      {/* Dynamic Golden Ring Backdrop and Mesh */}
      <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-25%] right-[-25%] w-[80%] h-[80%] bg-yellow-600/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="w-full max-w-7xl mx-auto py-2 flex items-center justify-between z-20 relative">
        <Link
          href="/"
          className="group flex items-center gap-2 text-[9px] tracking-[0.3em] text-[#EAE3DB]/40 hover:text-amber-400 uppercase transition-all duration-300 font-extrabold"
        >
          <span className="group-hover:-translate-x-1 transition-transform duration-300">←</span> BACK HOME
        </Link>
        
        <span className="text-[9px] tracking-[0.3em] text-amber-500/60 uppercase font-black flex items-center gap-1.5 select-none">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          SECURE OPERATOR KERNEL
        </span>
      </header>

      {/* Main Administrative Chest */}
      <main className="flex-1 flex items-center justify-center py-12 z-20 relative w-full">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[420px] flex flex-col"
        >
          {/* Scent Logo / Admin Identity */}
          <div className="flex flex-col items-center mb-8 select-none">
            <h2 className="text-[14px] tracking-[0.35em] text-[#EAE3DB]/50 uppercase font-black mb-2.5">
              LA MAISON GHARIB
            </h2>
            <h1 className="text-2xl font-serif-luxury font-medium tracking-[0.2em] text-amber-400 uppercase">
              ADMIN SIGN IN
            </h1>
          </div>

          {/* Glowing Gold Framed Glass Chest */}
          <div className="w-full bg-[#0a0503]/80 border border-amber-600/25 p-8 shadow-[0_30px_70px_rgba(0,0,0,0.8)] backdrop-blur-md relative group">
            
            {/* Corner Luxury Golden Accents */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-amber-500" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-amber-500" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-amber-500" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-amber-500" />

            <form onSubmit={handleAdminLogin} className="flex flex-col gap-6">
              
              {errorMsg && (
                <div className="text-[9.5px] tracking-widest text-red-400 uppercase font-black text-center border border-red-500/20 bg-red-950/20 py-3.5 px-4 flex items-center gap-2 justify-center leading-relaxed">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Email Form */}
              <div className="flex flex-col gap-2 relative">
                <label className="text-[8.5px] tracking-[0.25em] text-[#EAE3DB]/40 uppercase font-black pl-0.5">
                  OPERATOR EMAIL
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#EAE3DB]/30">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="admin@gharib.com"
                    className="bg-white/[0.02] border border-[#EAE3DB]/10 focus:border-amber-500/50 focus:bg-white/[0.04] rounded-none pl-11 pr-4 py-3.5 outline-none text-[11px] tracking-widest text-white font-medium placeholder-white/20 transition-all duration-300 w-full"
                  />
                </div>
              </div>

              {/* Password Form */}
              <div className="flex flex-col gap-2 relative">
                <label className="text-[8.5px] tracking-[0.25em] text-[#EAE3DB]/40 uppercase font-black pl-0.5">
                  SECURITY KEY
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#EAE3DB]/30">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="••••••••"
                    className="bg-white/[0.02] border border-[#EAE3DB]/10 focus:border-amber-500/50 focus:bg-white/[0.04] rounded-none pl-11 pr-11 py-3.5 outline-none text-[11px] tracking-widest text-white font-medium placeholder-white/20 transition-all duration-300 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#EAE3DB]/30 hover:text-amber-500 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[9.5px] font-black tracking-[0.25em] uppercase py-4.5 transition-all duration-300 shadow-[0_4px_18px_rgba(217,119,6,0.15)] hover:shadow-[0_4px_25px_rgba(217,119,6,0.3)] rounded-none cursor-pointer mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    DECRYPTING CREDENTIALS...
                  </>
                ) : (
                  "AUTHENTICATE OPERATOR"
                )}
              </button>
            </form>
          </div>
          
          <div className="mt-6 text-center select-none">
            <span className="text-[8px] tracking-[0.25em] text-[#EAE3DB]/20 uppercase font-bold">
              AUTHORIZED ACCESS ONLY • LOGS REGISTERED IN IP BACKPLANE
            </span>
          </div>
        </motion.div>
      </main>

      {/* Footer Area */}
      <footer className="w-full max-w-7xl mx-auto py-4 text-center z-20 relative flex flex-col md:flex-row items-center justify-between gap-3 border-t border-white/[0.03] pt-6 mt-4">
        <span className="text-[8px] tracking-[0.2em] text-[#EAE3DB]/30 uppercase font-bold">
          © {new Date().getFullYear()} GHARIB PRIVÉ ADMIN CONSOLE. ALL RIGHTS RESERVED.
        </span>
        <div className="flex items-center gap-1.5 text-[8px] tracking-[0.2em] text-[#EAE3DB]/30 font-bold uppercase select-none">
          <svg className="w-3 h-3 text-amber-500/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          ADMIN ACCESS RESTRICTED
        </div>
      </footer>

    </div>
  );
}

export default function AdminSignIn() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070301] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      }
    >
      <AdminSignInGate />
    </Suspense>
  );
}

function AdminSignInGate() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("redirect") || "/admin";
  // Only allow same-origin admin paths back through, so ?redirect= cannot be
  // used to bounce an authenticated admin to an attacker-controlled URL.
  const redirectTo = requested.startsWith("/admin") ? requested : "/admin";

  return <AdminSignInForm redirectTo={redirectTo} />;
}
