"use client";

import React, { useEffect, useState } from "react";

interface TocItem {
  id: string;
  text: string;
}

/** Contents rail with a scroll-spy that keeps the current section highlighted. */
export default function ArticleToc({ toc }: { toc: TocItem[] }) {
  const [activeTocId, setActiveTocId] = useState<string>("");

  useEffect(() => {
    if (toc.length === 0) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180;
      for (let i = toc.length - 1; i >= 0; i--) {
        const element = document.getElementById(toc[i].id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveTocId(toc[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [toc]);

  if (toc.length === 0) return null;

  return (
    <nav className="border-b border-[rgba(0,0,0,0.12)] py-8">
      <p className="maison-eyebrow">Contents</p>
      <ul className="mt-5 space-y-2.5">
        {toc.map((item) => {
          const isActive = activeTocId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`text-[14px] font-light leading-[1.6] transition-colors duration-300 ${
                  isActive ? "text-black" : "text-[#646464] hover:text-black"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
