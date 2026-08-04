import Link from "next/link";

export default function NotFound() {
  return (
    <main className="maison flex min-h-screen flex-col items-center justify-center gap-8 bg-white px-6 text-center">
      <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">Page not found</p>
      <h1 className="font-display text-[28px] leading-none tracking-[0.1em] uppercase text-black">
        This page does not exist
      </h1>
      <p className="max-w-[46ch] text-[14px] font-light leading-relaxed text-[#646464]">
        The page you are looking for may have been moved or is no longer available.
      </p>
      <Link href="/" className="maison-btn-outline">
        Return to the maison
      </Link>
    </main>
  );
}
