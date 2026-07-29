"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import { BLOG_POSTS, BlogPost } from "../../data/blogPosts";
import { clientSafeSupabase } from "../../lib/supabase";

/** A fragrance named in the copy that was matched to a real row in public.products. */
interface MentionedProduct {
  id: number;
  name: string;
  brand: string | null;
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function BlogDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [post, setPost] = useState<BlogPost | undefined>(() =>
    BLOG_POSTS.find((p) => p.slug === slug)
  );
  const [activeTocId, setActiveTocId] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  // Fragrances named in the story, resolved against the live catalogue.
  const [mentionedProducts, setMentionedProducts] = useState<MentionedProduct[]>([]);

  useEffect(() => {
    if (!slug) return;
    const fetchDbPost = async () => {
      try {
        const { data, error } = await clientSafeSupabase
          .from("blog_posts")
          .select("*")
          .eq("slug", slug)
          .single();

        if (!error && data) {
          const mapped: BlogPost = {
            id: String(data.id),
            title: data.title,
            slug: data.slug,
            metaTitle: data.title,
            metaDescription: data.summary || data.title,
            category: "Heritage & Artistry",
            publishDate: new Date(data.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            readTime: "5 min read",
            excerpt: data.summary || (data.content ? data.content.replace(/<[^>]+>/g, "").slice(0, 140) + "..." : ""),
            heroImage: data.cover_image || "/bento-oud-imperial.png",
            author: {
              name: data.author || "Gharib Master Perfumer",
              role: "Olfactory Specialist",
              avatar: "/bento-oud-imperial.png"
            },
            targetKeyword: data.title,
            contentHtml: data.content,
            toc: [],
            faqs: [],
            relatedProducts: []
          };
          setPost(mapped);
        }
      } catch (err) {
        console.error("Error loading blog post from Supabase:", err);
      }
    };
    fetchDbPost();
  }, [slug]);

  // Resolve the fragrances named in the story against public.products. Anything
  // the shop does not actually carry is dropped rather than linked to nothing.
  useEffect(() => {
    const names = post?.relatedProducts ?? [];
    if (names.length === 0) return;

    let cancelled = false;
    const resolveMentions = async () => {
      try {
        const { data, error } = await clientSafeSupabase
          .from("products")
          .select("id, name, brand");
        if (error || !Array.isArray(data) || cancelled) return;

        const rows = data as MentionedProduct[];
        const resolved: MentionedProduct[] = [];
        names.forEach((mention) => {
          const key = normalise(mention);
          const match = rows.find((row) => {
            const rowKey = normalise(row.name || "");
            return rowKey === key || rowKey.includes(key) || key.includes(rowKey);
          });
          if (match && !resolved.some((r) => r.id === match.id)) resolved.push(match);
        });

        if (!cancelled) setMentionedProducts(resolved);
      } catch (err) {
        console.error("Could not resolve the fragrances named in this story:", err);
      }
    };

    resolveMentions();
    return () => {
      cancelled = true;
    };
  }, [post]);

  // Set active scroll spy for Table of Contents
  useEffect(() => {
    if (!post) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180;
      for (let i = post.toc.length - 1; i >= 0; i--) {
        const element = document.getElementById(post.toc[i].id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveTocId(post.toc[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [post]);

  if (!post) {
    return (
      <div className="maison min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="maison-eyebrow">The Journal</p>
        <h1 className="maison-page-title">Article Not Found</h1>
        <p className="max-w-[46ch] text-[15px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
          The requested perfume guide does not exist or has been relocated.
        </p>
        <Link href="/blogs" className="maison-btn-outline mt-2">
          Return to the journal
        </Link>
      </div>
    );
  }

  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  const canonicalUrl = `https://gharibperfumes.ae/blogs/${post.slug}`;
  const encodedShare = encodeURIComponent(canonicalUrl);
  const encodedTitle = encodeURIComponent(post.title);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Structured Schema.org JSON-LD for Google Page 1 Rankings
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.metaTitle,
    "description": post.metaDescription,
    "image": [post.heroImage],
    "datePublished": "2026-10-24T08:00:00+04:00",
    "dateModified": "2026-10-28T08:00:00+04:00",
    "author": {
      "@type": "Person",
      "name": post.author.name,
      "jobTitle": post.author.role
    },
    "publisher": {
      "@type": "Organization",
      "name": "Gharib Dubai",
      "logo": {
        "@type": "ImageObject",
        "url": "https://gharibperfumes.ae/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://gharibperfumes.ae/blogs/${post.slug}`
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": post.faqs.map((f) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer
      }
    }))
  };

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Schema.org Structured Data Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Shared Unified White Navbar */}
      <AppHeader activePage="blogs" />

      <main className="flex-grow">
        {/* Breadcrumb */}
        <div className="border-b border-[rgba(0,0,0,0.12)]">
          <nav className="maison-container flex items-center gap-3 py-5 text-[12px] uppercase tracking-[0.1em] text-[#646464]">
            <Link href="/" className="transition-colors duration-300 hover:text-black">
              Home
            </Link>
            <span>/</span>
            <Link href="/blogs" className="transition-colors duration-300 hover:text-black">
              Journal
            </Link>
            <span>/</span>
            <span className="truncate max-w-[180px] text-black md:max-w-[520px]">
              {post.title}
            </span>
          </nav>
        </div>

        {/* Full-bleed hero */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.heroImage}
          alt={post.title}
          className="w-full h-[300px] md:h-[620px] object-cover"
        />

        <article className="maison-container">
          <div className="mx-auto w-full max-w-[720px] pt-12 md:pt-16 pb-16 md:pb-24">
            {/* Article masthead */}
            <p className="maison-eyebrow text-center">
              {post.category} — {post.publishDate} — {post.readTime}
            </p>

            <h1 className="mt-6 text-center font-display uppercase text-[22px] md:text-[32px] leading-[1.3] tracking-[0.08em] text-black">
              {post.title}
            </h1>

            <p className="maison-eyebrow mt-6 text-center">
              By {post.author.name} — {post.author.role}
            </p>

            <hr className="maison-rule mt-10" />

            {/* Contents */}
            {post.toc.length > 0 && (
              <nav className="border-b border-[rgba(0,0,0,0.12)] py-8">
                <p className="maison-eyebrow">Contents</p>
                <ul className="mt-5 space-y-2.5">
                  {post.toc.map((item) => {
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
            )}

            {/* Article body */}
            <div
              className="maison-prose mt-12"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />

            {/* Shop callout */}
            <aside className="mt-16 bg-[#F5F5F5] px-6 py-12 text-center md:px-12">
              <p className="maison-eyebrow">Verified authentic sourcing</p>
              <h2 className="mt-5 font-display uppercase text-[18px] md:text-[22px] leading-[1.35] tracking-[0.08em] text-black">
                Looking to buy authentic perfume in Dubai?
              </h2>
              <p className="mx-auto mt-5 max-w-[46ch] text-[15px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                Shop 100% factory-direct Arabian and niche fragrances with same-day Dubai express
                delivery.
              </p>
              <div className="mt-8">
                <Link href="/#new-in" className="maison-btn-outline">
                  Shop the collection
                </Link>
              </div>
            </aside>

            {/* Fragrances mentioned */}
            {mentionedProducts.length > 0 && (
              <section className="mt-16">
                <p className="maison-eyebrow">Fragrances in this story</p>
                <ul className="mt-6 border-t border-[rgba(0,0,0,0.12)]">
                  {mentionedProducts.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-6 border-b border-[rgba(0,0,0,0.12)] py-5"
                    >
                      <span className="font-display uppercase text-[15px] leading-[1.3] tracking-[0.08em] text-black">
                        {item.name}
                      </span>
                      <Link href={`/product/${item.id}`} className="maison-link shrink-0">
                        Shop
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Author */}
            <section className="mt-16 border-t border-[rgba(0,0,0,0.12)] pt-10">
              <p className="maison-eyebrow">Written by</p>
              <h2 className="mt-4 font-display uppercase text-[18px] leading-[1.3] tracking-[0.08em] text-black">
                {post.author.name}
              </h2>
              <p className="maison-eyebrow mt-3">{post.author.role}</p>
              <p className="mt-5 max-w-[60ch] text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                Specializing in Middle Eastern perfumery heritage, factory batch authentication, and
                olfactory molecular chemistry in high-temperature desert climates.
              </p>
            </section>

            {/* Share */}
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
          </div>
        </article>

        {/* More stories */}
        {relatedPosts.length > 0 && (
          <section className="border-t border-[rgba(0,0,0,0.12)]">
            <div className="maison-container maison-section">
              <p className="maison-eyebrow text-center">More stories</p>

              <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-3">
                {relatedPosts.map((rPost) => (
                  <article key={rPost.id} className="group flex flex-col">
                    <Link href={`/blogs/${rPost.slug}`} className="block overflow-hidden">
                      <div className="w-full aspect-[3/2] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={rPost.heroImage}
                          alt={rPost.title}
                          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                        />
                      </div>
                    </Link>

                    <p className="maison-eyebrow mt-6">
                      {rPost.publishDate} — {rPost.category}
                    </p>

                    <Link href={`/blogs/${rPost.slug}`}>
                      <h2 className="mt-3 font-display uppercase text-[18px] leading-[1.3] tracking-[0.08em] text-black transition-opacity duration-300 group-hover:opacity-60">
                        {rPost.title}
                      </h2>
                    </Link>

                    <div className="mt-auto pt-6">
                      <Link href={`/blogs/${rPost.slug}`} className="maison-link">
                        Read
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
