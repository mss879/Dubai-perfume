"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function SignInPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [inputEmail, setInputEmail] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize and sync authentication state on mount
  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail");
    if (storedEmail) {
      setUserEmail(storedEmail);
    }
  }, []);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim()) {
      setErrorMsg("Please fill in your email address.");
      return;
    }
    
    // Save state
    localStorage.setItem("userEmail", inputEmail.trim());
    setUserEmail(inputEmail.trim());
    
    // Set notification for homepage
    const msg = authMode === "signin" 
      ? "Welcome back. You are now signed in." 
      : "Account created successfully. Welcome.";
    localStorage.setItem("authNotification", msg);

    // Redirect to homepage
    router.push("/");
  };

  const handleSignOut = () => {
    localStorage.removeItem("userEmail");
    setUserEmail(null);
    setInputEmail("");
    setInputPassword("");
    
    // Set sign-out notification for homepage
    localStorage.setItem("authNotification", "Successfully signed out.");
    
    // Redirect to homepage
    router.push("/");
  };

  return (
    <div className="relative min-h-screen bg-[#FAF6F0] text-[#1C130D] flex flex-col justify-between font-sans-luxury overflow-hidden select-none p-6 md:p-12">
      
      {/* ═══════════════════════════════════════════════════
          BACKGROUND: Full-Page Cinematic AI Video Loop
          ═══════════════════════════════════════════════════ */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover blur-[3px] scale-105"
        >
          <source src="/signin_bg.mp4" type="video/mp4" />
          {/* 
            Fallback Luxury Image:
            Renders our premium splashing amber droplets on draped silk asset 
            so the page is immediately beautiful until signin_bg.mp4 is added!
          */}
          <img 
            src="/luxury_gold_silk.png" 
            className="absolute inset-0 w-full h-full object-cover blur-[3px] scale-105" 
            alt="Luxury Backdrop Fallback" 
          />
        </video>
        {/* Subtle 20% warm luxury cream tint overlay */}
        <div className="absolute inset-0 bg-[#FAF6F0]/20 mix-blend-normal pointer-events-none" />
      </div>

      {/* Navigation Header */}
      <header className="w-full max-w-7xl mx-auto py-2 flex items-center z-20 relative">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-[10px] tracking-[0.25em] text-[#1C130D]/60 hover:text-amber-700 uppercase transition-all duration-300 font-extrabold cursor-pointer decoration-none"
        >
          <span className="group-hover:-translate-x-1.5 transition-transform duration-300 inline-block font-sans">←</span> BACK HOME
        </Link>
      </header>

      {/* Main Container: Centers the Sign In Chest on top of the 3D video box */}
      <main className="flex-1 flex items-center justify-center py-10 z-20 relative w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[420px] flex flex-col"
        >
          {/* Header Area */}
          <div className="flex flex-col items-center mb-8 select-none">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              <span className="text-[9px] tracking-[0.35em] text-amber-700 uppercase font-black">
                PRIVÉ MEMBER GATEWAY
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif-luxury font-medium tracking-[0.18em] text-[#1C130D] uppercase text-center">
              {userEmail ? "MY ACCOUNT" : (authMode === "signin" ? "SIGN IN" : "JOIN THE CLUB")}
            </h1>
          </div>

          <AnimatePresence mode="wait">
            {userEmail ? (
              // SIGNED IN DASHBOARD (Floating frosted crystal chest)
              <motion.div
                key="signed-in"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
                className="w-full bg-white/90 border border-white/95 backdrop-blur-3xl p-8 shadow-[0_40px_90px_rgba(46,34,25,0.06),inset_0_1px_2px_rgba(255,255,255,0.6)]"
              >
                <div className="flex flex-col items-center text-center">
                  
                  {/* Dynamic crown avatar badge */}
                  <div className="relative w-16 h-16 rounded-full border border-amber-600/35 bg-white/60 flex items-center justify-center mb-6 shadow-[0_8px_20px_rgba(217,119,6,0.08)]">
                    <svg className="w-7 h-7 text-amber-700" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                    </svg>
                    <span className="absolute inset-0 rounded-full border border-amber-600/30 animate-ping opacity-60 scale-105" />
                  </div>

                  <span className="text-[9px] tracking-[0.25em] text-[#1C130D]/40 uppercase font-black">
                    AUTHENTICATED ACCOUNT
                  </span>
                  <h4 className="text-sm font-semibold tracking-[0.15em] text-amber-800 uppercase mt-2 mb-8 break-all max-w-[280px]">
                    {userEmail}
                  </h4>

                  {/* Member privileges list */}
                  <div className="w-full bg-[#FAF7F2]/80 border border-amber-900/[0.05] p-5.5 text-left mb-8">
                    <h5 className="text-[10px] tracking-[0.22em] text-amber-700 font-black uppercase mb-3.5 flex items-center gap-1.5">
                      <span className="text-xs">✦</span> PRIVÉ MEMBERSHIP STATUS
                    </h5>
                    <ul className="text-[10px] tracking-[0.15em] text-[#1C130D]/70 uppercase font-bold space-y-3">
                      <li className="flex items-center gap-2">
                        <span className="text-amber-600 text-xs">✓</span> Complimentary scent sample sets
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-amber-600 text-xs">✓</span> 10% Preferred pricing active
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-amber-600 text-xs">✓</span> Climate-guarded white glove delivery
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={handleSignOut}
                    className="w-full bg-transparent border border-neutral-300 hover:border-amber-600 text-neutral-800 hover:text-amber-700 text-[10px] font-black tracking-[0.25em] uppercase py-4 transition-all duration-300 rounded-none cursor-pointer"
                  >
                    SECURE SIGN OUT
                  </button>
                </div>
              </motion.div>
            ) : (
              // SIGN IN & SIGN UP FORM CASE (Overlaying centered video box)
              <motion.div
                key="auth-form"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
                className="w-full bg-white/90 border border-white/95 backdrop-blur-3xl p-8 md:p-10 shadow-[0_40px_90px_rgba(46,34,25,0.06),inset_0_1px_2px_rgba(255,255,255,0.6)]"
              >
                <form onSubmit={handleAuthSubmit} className="flex flex-col gap-6">
                  {errorMsg && (
                    <div className="text-[9.5px] tracking-widest text-red-500 uppercase font-black text-center border border-red-500/20 bg-red-500/5 py-2.5">
                      {errorMsg}
                    </div>
                  )}

                  {/* Email Input */}
                  <div className="flex flex-col gap-2 relative group">
                    <label className="text-[8.5px] tracking-[0.25em] text-[#1C130D]/50 uppercase font-black pl-0.5">
                      EMAIL ADDRESS
                    </label>
                    <input 
                      type="email" 
                      required
                      value={inputEmail}
                      onChange={(e) => {
                        setInputEmail(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="email@example.com"
                      className="bg-white/60 border border-[#1C130D]/10 focus:border-amber-600/50 focus:bg-white rounded-none px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C130D] font-medium placeholder-[#1C130D]/20 transition-all duration-300 w-full"
                    />
                  </div>

                  {/* Password Input */}
                  <div className="flex flex-col gap-2 relative group">
                    <label className="text-[8.5px] tracking-[0.25em] text-[#1C130D]/50 uppercase font-black pl-0.5">
                      PASSWORD
                    </label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required
                        value={inputPassword}
                        onChange={(e) => {
                          setInputPassword(e.target.value);
                          setErrorMsg(null);
                        }}
                        placeholder="••••••••"
                        className="bg-white/60 border border-[#1C130D]/10 focus:border-amber-600/50 focus:bg-white rounded-none pl-4 pr-11 py-3.5 outline-none text-[11px] tracking-widest text-[#1C130D] font-medium placeholder-[#1C130D]/20 transition-all duration-300 w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-amber-700 transition-colors p-1 cursor-pointer"
                      >
                        {showPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {authMode === "signup" && (
                    <div className="flex items-center gap-2.5 mt-0.5">
                      <input 
                        type="checkbox" 
                        required 
                        id="terms-agreement" 
                        className="rounded-none accent-amber-600 w-3.5 h-3.5 cursor-pointer" 
                      />
                      <label 
                        htmlFor="terms-agreement" 
                        className="text-[8.5px] tracking-widest text-[#1C130D]/40 uppercase font-black select-none cursor-pointer leading-none"
                      >
                        I agree to terms & conditions
                      </label>
                    </div>
                  )}

                  {/* CTA Submit Button */}
                  <button 
                    type="submit"
                    className="w-full bg-[#8C6239] text-white hover:bg-[#1C130D] text-[9.5px] font-black tracking-[0.25em] uppercase py-4.5 transition-all duration-300 shadow-[0_4px_12px_rgba(140,98,57,0.15)] hover:shadow-[0_4px_18px_rgba(28,19,13,0.22)] rounded-none cursor-pointer mt-3 z-30"
                  >
                    {authMode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
                  </button>
                </form>

                {/* Switch Link */}
                <div className="mt-8 text-center">
                  <button 
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === "signin" ? "signup" : "signin");
                      setErrorMsg(null);
                    }}
                    className="text-[9px] tracking-[0.2em] text-[#1C130D]/45 hover:text-amber-700 uppercase transition-colors duration-300 font-extrabold cursor-pointer"
                  >
                    {authMode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Footer Area */}
      <footer className="w-full max-w-7xl mx-auto py-4 text-center z-20 relative flex flex-col md:flex-row items-center justify-between gap-3 border-t border-[#1C130D]/5 pt-6 mt-4">
        <span className="text-[8px] tracking-[0.2em] text-[#1C130D]/30 uppercase font-bold">
          © {new Date().getFullYear()} GHARIB PRIVÉ. ALL RIGHTS RESERVED.
        </span>
        <div className="flex items-center gap-1.5 text-[8px] tracking-[0.2em] text-[#1C130D]/30 font-bold uppercase select-none">
          <svg className="w-3 h-3 text-amber-700/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          SSL SECURE DATA
        </div>
      </footer>

    </div>
  );
}
