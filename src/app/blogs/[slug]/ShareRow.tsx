"use client";

import React, { useState } from "react";

/** Share footer: copy-link plus WhatsApp / X / Facebook intents. */
export default function ShareRow({
  title,
  canonicalUrl,
}: {
  title: string;
  canonicalUrl: string;
}) {
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const encodedShare = encodeURIComponent(canonicalUrl);
  const encodedTitle = encodeURIComponent(title);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <footer className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5 border-t border-[rgba(0,0,0,0.12)] pt-8">
      <span className="maison-eyebrow">Share this story</span>
      <button onClick={handleShare} className="maison-link cursor-pointer">
        {copiedLink ? "Link copied" : "Copy link"}
      </button>
      <a
        href={`https://wa.me/?text=${encodedTitle}%20${encodedShare}`}
        target="_blank"
        rel="noopener noreferrer"
        className="maison-link"
      >
        WhatsApp
      </a>
      <a
        href={`https://x.com/intent/post?text=${encodedTitle}&url=${encodedShare}`}
        target="_blank"
        rel="noopener noreferrer"
        className="maison-link"
      >
        X
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShare}`}
        target="_blank"
        rel="noopener noreferrer"
        className="maison-link"
      >
        Facebook
      </a>
    </footer>
  );
}
