import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Write to the Gharib client advisors in Dubai for orders, private appointments and wholesale enquiries. Every message receives a considered reply within 24 hours.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactClient />;
}
