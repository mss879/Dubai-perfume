"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import ConciergeWidget from "../components/concierge/ConciergeWidget";
import { FREE_SHIPPING_THRESHOLD_AED, SHIPPING_FEE_AED } from "../lib/shipping";

const HAIRLINE = "rgba(0,0,0,0.12)";

type FaqRow = { question: string; answer: string };

const CONTACT_FAQS: FaqRow[] = [
  {
    question: "How quickly will my enquiry be answered?",
    answer:
      "A client advisor replies to every message within 24 hours. Orders placed over a weekend are answered on the next working day.",
  },
  {
    question: "Do you deliver across the United Arab Emirates?",
    answer: `Yes. Delivery is complimentary on orders over AED ${FREE_SHIPPING_THRESHOLD_AED}, and AED ${SHIPPING_FEE_AED} below that. Each parcel is dispatched from our Al Quoz boutique.`,
  },
  {
    question: "Are the fragrances authentic?",
    answer:
      "Every fragrance we sell is 100% authentic and sourced directly from the maison or its appointed Gulf distributor.",
  },
  {
    question: "Can I try a fragrance before committing to a bottle?",
    answer:
      "Two discovery samples accompany every order. You are also welcome to book a private session in the boutique and be guided through the collection.",
  },
  {
    question: "Do you accept wholesale orders?",
    answer:
      "We do. Choose Wholesale Order Inquiries in the subject field of the form and our trade desk will contact you with terms.",
  },
];

export default function ContactClient() {
  const router = useRouter();

  // Contact Form States
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "General Inquiries",
    message: "",
  });

  const [isSending, setIsSending] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const subjectOptions = [
    "General Inquiries",
    "Wholesale Order Inquiries",
    "Order/Shipping Inquiries",
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when typing
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubjectSelect = (opt: string) => {
    setFormData((prev) => ({ ...prev, subject: opt }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // 1. Honeypot check (anti-bot)
    if (honeypot) {
      errors.spam = "Spam detection triggered.";
      return errors;
    }

    // 2. Name validation (no numeric values, minimum 3 chars)
    const nameTrimmed = formData.name.trim();
    if (nameTrimmed.length < 3) {
      errors.name = "Name must be at least 3 characters.";
    } else if (!/^[a-zA-Z\s'.]+$/.test(nameTrimmed)) {
      errors.name = "Name can only contain letters and spaces.";
    }

    // 3. Email validation & block common disposable/spam domains
    const emailTrimmed = formData.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      errors.email = "Please enter a valid email.";
    } else {
      const disposableDomains = [
        "mailinator.com", "yopmail.com", "tempmail.com", "trashmail.com",
        "10minutemail.com", "guerrillamail.com", "sharklasers.com", "dispostable.com"
      ];
      const domain = emailTrimmed.split("@")[1];
      if (disposableDomains.includes(domain)) {
        errors.email = "Please use a real email address.";
      }
    }

    // 4. Message validation (avoid very short spam or ultra long dumps)
    const msgTrimmed = formData.message.trim();
    if (msgTrimmed.length < 15) {
      errors.message = "Your message must be at least 15 characters.";
    } else if (msgTrimmed.length > 2000) {
      errors.message = "Your message is too long (max 2000 characters).";
    }

    // 5. Anti-spam: check for url structures in name or message
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|\.com\/|\.net\/|\.org\/)/i;
    if (urlPattern.test(msgTrimmed) || urlPattern.test(nameTrimmed)) {
      errors.message = "Please do not include links or websites.";
    }

    // 6. Anti-spam Rate Limiting: 60-second cooldown
    const lastSubmit = localStorage.getItem("last_inquiry_submit");
    if (lastSubmit) {
      const timeDiff = Date.now() - parseInt(lastSubmit);
      const limitWindow = 60000;
      if (timeDiff < limitWindow) {
        const secsLeft = Math.ceil((limitWindow - timeDiff) / 1000);
        errors.rateLimit = `You already sent a message. Please wait ${secsLeft} seconds.`;
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      if (errors.spam) {
        // Silently mimic success to bot
        setIsSubmitted(true);
        return;
      }
      setValidationErrors(errors);
      if (errors.rateLimit) {
        setSubmitError(errors.rateLimit);
      }
      return;
    }

    setIsSending(true);

    try {
      // Submitted through the server rather than straight to PostgREST. Every
      // check above runs in the browser, so a spammer posting directly at the
      // table skipped all of them — /api/contact re-validates and rate limits
      // where it cannot be bypassed. Migration 44 closes the direct write.
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          subject: formData.subject,
          message: formData.message.trim(),
          company: honeypot,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to transmit inquiry.");
      }

      // Record successful submit time for rate limiting
      localStorage.setItem("last_inquiry_submit", Date.now().toString());

      setIsSubmitted(true);
      setFormData({
        name: "",
        email: "",
        subject: "General Inquiries",
        message: "",
      });
      setValidationErrors({});
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "An unexpected network error occurred. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  const scrollToEnquiry = () => {
    handleSubjectSelect("General Inquiries");
    document.getElementById("enquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Shared Unified White Navbar */}
      <AppHeader activePage="contact" />

      <main className="flex-grow">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Client Services</p>
          <h1 className="maison-page-title mt-5">Contact Us</h1>
          <p className="mx-auto mt-6 max-w-[60ch] text-[15px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
            For orders, private appointments and wholesale enquiries, write to our advisors in Dubai.
            Every message receives a considered reply within 24 hours.
          </p>
        </section>

        {/* ── Enquiry form + boutique details (55 / 45) ────────────── */}
        <section id="enquiry" className="maison-container pb-14 md:pb-20">
          <div className="grid grid-cols-1 gap-x-16 gap-y-16 lg:grid-cols-[55fr_45fr]">
            {/* ── Left: enquiry form / confirmation ────────────────── */}
            <div>
              {!isSubmitted ? (
                <>
                  <p className="maison-eyebrow">Write to us</p>
                  <h2 className="mt-4 font-display uppercase text-[20px] md:text-[22px] leading-[1.2] tracking-[0.1em] text-black">
                    Send an enquiry
                  </h2>

                  <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-7 text-left">
                    {/* Honeypot field (hidden from users, bot trap) */}
                    <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" aria-hidden="true">
                      <label htmlFor="company">Company (Do not fill)</label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="maison-label">Your name</label>
                      <input
                        id="name"
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Full name"
                        className="maison-input"
                      />
                      {validationErrors.name && (
                        <p className="mt-2 text-[13px] font-light leading-[1.6] text-[#646464]">
                          {validationErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="maison-label">Your email</label>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="name@email.com"
                        className="maison-input"
                      />
                      {validationErrors.email && (
                        <p className="mt-2 text-[13px] font-light leading-[1.6] text-[#646464]">
                          {validationErrors.email}
                        </p>
                      )}
                    </div>

                    {/* Subject */}
                    <div>
                      <label htmlFor="subject" className="maison-label">Subject</label>
                      <div className="relative">
                        <select
                          id="subject"
                          name="subject"
                          value={formData.subject}
                          onChange={(e) => handleSubjectSelect(e.target.value)}
                          className="maison-select cursor-pointer"
                          style={{ paddingRight: 36 }}
                        >
                          {subjectOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-[12px] text-[#646464]"
                        >
                          &#9662;
                        </span>
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="message" className="maison-label">Your message</label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={7}
                        value={formData.message}
                        onChange={handleInputChange}
                        placeholder="How may we help you?"
                        className="maison-textarea"
                      />
                      {validationErrors.message && (
                        <p className="mt-2 text-[13px] font-light leading-[1.6] text-[#646464]">
                          {validationErrors.message}
                        </p>
                      )}
                    </div>

                    {/* Submit error — plain text over a hairline */}
                    {submitError && (
                      <p
                        className="border-t pt-4 text-[14px] font-light leading-[1.7] text-black"
                        style={{ borderColor: HAIRLINE }}
                      >
                        {submitError}
                      </p>
                    )}

                    <button type="submit" disabled={isSending} className="maison-btn w-full">
                      {isSending ? "Sending" : "Send message"}
                    </button>

                    <p className="text-[13px] font-light leading-[1.7] text-[#646464]">
                      By writing to us you agree that we may use your details solely to answer this enquiry.
                    </p>
                  </form>
                </>
              ) : (
                /* Confirmation — plain type over a hairline, no panel */
                <div className="border-t pt-10" style={{ borderColor: HAIRLINE }}>
                  <p className="maison-eyebrow">Message sent</p>
                  <h2 className="mt-4 font-display uppercase text-[20px] md:text-[22px] leading-[1.2] tracking-[0.1em] text-black">
                    Thank you
                  </h2>
                  <p className="mt-6 max-w-[52ch] text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                    We have received your message. A client advisor will reply within 24 hours.
                  </p>
                  <p className="mt-6 text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                    Gharib Perfumes, Dubai
                  </p>

                  <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="maison-btn-outline w-full sm:w-auto sm:flex-1"
                    >
                      Send another message
                    </button>
                    <button
                      onClick={() => router.push("/")}
                      className="maison-btn w-full sm:w-auto sm:flex-1"
                    >
                      Go to home
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: boutique details ──────────────────────────── */}
            <aside className="border-t" style={{ borderColor: HAIRLINE }}>
              <div className="border-b py-7" style={{ borderColor: HAIRLINE }}>
                <p className="maison-eyebrow">Boutique</p>
                <p className="mt-4 text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                  Alserkal Avenue, Al Quoz 1
                  <br />
                  Dubai, United Arab Emirates
                </p>
              </div>

              <div className="border-b py-7" style={{ borderColor: HAIRLINE }}>
                <p className="maison-eyebrow">Opening hours</p>
                <p className="mt-4 text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                  Every day, 10:00 – 22:00
                  <br />
                  Private visits by appointment.
                </p>
              </div>

              <div className="border-b py-7" style={{ borderColor: HAIRLINE }}>
                <p className="maison-eyebrow">Reach us</p>
                <p className="mt-4 text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                  Telephone{" "}
                  <a
                    href="tel:+97143808888"
                    className="transition-colors duration-300 hover:text-black"
                  >
                    +971 4 380 8888
                  </a>
                  <br />
                  Email{" "}
                  <a
                    href="mailto:info@gharib.com"
                    className="transition-colors duration-300 hover:text-black"
                  >
                    info@gharib.com
                  </a>
                </p>
              </div>

              <div className="border-b py-7" style={{ borderColor: HAIRLINE }}>
                <p className="maison-eyebrow">Other boutiques</p>
                <p className="mt-4 text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                  The Dubai Mall — Fashion Avenue, Level 1
                  <br />
                  Galeries Lafayette — The Dubai Mall
                </p>
              </div>

              <div className="border-b py-7" style={{ borderColor: HAIRLINE }}>
                <p className="maison-eyebrow">Private visit</p>
                <p className="mt-4 text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                  Book a private session with us. We will help you choose — or compose — a fragrance
                  that belongs to you alone.
                </p>
                <button onClick={scrollToEnquiry} className="maison-link mt-6 cursor-pointer">
                  Book a session
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* ── Frequently asked ─────────────────────────────────────── */}
        <section className="maison-container maison-section border-t" style={{ borderColor: HAIRLINE }}>
          <div className="mx-auto max-w-[820px]">
            <div className="text-center">
              <p className="maison-eyebrow">Client services</p>
              <h2 className="maison-page-title mt-5">Frequently asked</h2>
            </div>

            <div className="mt-10 md:mt-14">
              {CONTACT_FAQS.map((faq) => (
                <details key={faq.question} className="maison-accordion">
                  <summary>{faq.question}</summary>
                  <p className="pb-5 pr-8 text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                    {faq.answer}
                  </p>
                </details>
              ))}
              <hr className="maison-rule" />
            </div>
          </div>
        </section>

        {/* ── Boutique image, full bleed ───────────────────────────── */}
        <section>
          <div className="maison-container pb-10 md:pb-14 text-center">
            <p className="maison-eyebrow">Alserkal Avenue — Al Quoz 1, Dubai</p>
            <h2 className="maison-page-title mt-5">Visit the boutique</h2>
            <div className="mt-7">
              <a
                href="https://maps.google.com/?q=Alserkal+Avenue+Al+Quoz+1+Dubai"
                target="_blank"
                rel="noopener noreferrer"
                className="maison-link"
              >
                Get directions
              </a>
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/campaign-silver.png"
            alt="Gharib Perfumes editorial still life"
            className="w-full h-[300px] md:h-[520px] object-cover"
          />
        </section>
      </main>

      <Footer />
      <ConciergeWidget />
    </div>
  );
}
