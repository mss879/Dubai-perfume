"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getBrowserSupabase } from "../../lib/supabase-browser";

/**
 * `customers.is_admin` is the only thing that grants access. Email substrings
 * and `user_metadata.is_admin` are client-forgeable and are not trusted; the
 * server re-checks the same column in src/app/lib/auth.ts before any admin
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

export default function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setErrorMsg(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
        setLoading(false);
        return;
      }
      const user = data?.user;
      if (!user || !(await isVerifiedAdmin(user.id))) {
        // Not an admin: sign straight back out, so no half-session lingers.
        await supabase.auth.signOut();
        setErrorMsg("This account doesn't have admin access.");
        setLoading(false);
        return;
      }
      // refresh() lets the server layout see the new session cookie.
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setErrorMsg("Couldn't reach the server. Check your connection and try again.");
      setLoading(false);
    }
  };

  const inputClass =
    "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[16px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 sm:text-[15px]";

  return (
    <form onSubmit={signIn} className="flex flex-col gap-5">
      {errorMsg ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-[14px] text-red-800">
          {errorMsg}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-email" className="text-[14px] font-medium text-neutral-800">
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrorMsg(null);
          }}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-password" className="text-[14px] font-medium text-neutral-800">
          Password
        </label>
        <div className="relative">
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorMsg(null);
            }}
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-500 hover:text-neutral-900"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-900 text-[15px] font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
