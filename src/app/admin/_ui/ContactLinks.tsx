import { Mail, MessageCircle, Phone } from "lucide-react";
import { cn } from "./cn";

/** Email, call and WhatsApp, each one tap away. */
export function ContactLinks({
  email,
  phone,
  className,
}: {
  email?: string | null;
  phone?: string | null;
  className?: string;
}) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const link = "inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900 hover:underline";
  return (
    <div className={cn("flex flex-col gap-1.5 text-[14px]", className)}>
      {email ? (
        <a href={`mailto:${email}`} className={cn(link, "break-all")}>
          <Mail className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          {email}
        </a>
      ) : null}
      {phone ? (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={link}>
          <Phone className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          {phone}
        </a>
      ) : null}
      {digits.length >= 8 ? (
        <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className={link}>
          <MessageCircle className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
