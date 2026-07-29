"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Clock,
  ArrowLeft,
  Share2,
  Bookmark,
  Check,
  ChevronRight,
  ShieldCheck,
  Award,
  Sparkles,
  ShoppingBag,
  HelpCircle,
  BookOpen
} from "lucide-react";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import { BLOG_POSTS, BlogPost } from "../../data/blogPosts";
import { clientSafeSupabase } from "../../lib/supabase";

export default function BlogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [post, setPost] = useState<BlogPost | undefined>(() => 
    BLOG_POSTS.find((p) => p.slug === slug)
  );
  const [activeTocId, setActiveTocId] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

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
      <div className="min-h-screen bg-[#FAF6F0] text-[#1C120C] flex flex-col justify-center items-center gap-6 p-6">
        <h1 className="text-2xl font-serif-luxury text-[#3B1F0B]">Article Not Found</h1>
        <p className="text-xs text-neutral-500 uppercase tracking-widest">
          The requested perfume guide does not exist or has been relocated.
        </p>
        <Link
          href="/blogs"
          className="border border-amber-800 text-amber-800 text-[10px] tracking-widest uppercase py-3 px-8 hover:bg-amber-800 hover:text-white transition-all font-bold"
        >
          Return to Olfactory Journal
        </Link>
      </div>
    );
  }

  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

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
    <div className="min-h-screen bg-[#FAF6F0] text-[#1C120C] flex flex-col justify-between font-sans-luxury relative overflow-x-hidden pt-20">
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

      {/* Top Breadcrumb Header */}
      <div className="bg-white border-b border-amber-800/10 py-4 px-6 md:px-12">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-neutral-500">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-amber-800 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-neutral-400" />
            <Link href="/blogs" className="hover:text-amber-800 transition-colors">
              Blogs
            </Link>
            <ChevronRight className="w-3 h-3 text-neutral-400" />
            <span className="text-[#3B1F0B] truncate max-w-[200px] md:max-w-md">
              {post.title}
            </span>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-amber-800 hover:text-amber-900 font-extrabold cursor-pointer border border-amber-800/20 px-3 py-1.5 bg-amber-800/5 transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? "Copied Link!" : "Share"}</span>
          </button>
        </div>
      </div>

      {/* Main Article Container */}
      <article className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 w-full flex-grow">
        {/* Article Header Info */}
        <div className="max-w-4xl mx-auto mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-800/10 text-amber-900 text-[9px] tracking-[0.2em] font-extrabold uppercase mb-4 border border-amber-800/20">
            <span>{post.category}</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-serif-luxury text-[#3B1F0B] tracking-tight leading-tight mb-6">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-600 border-y border-amber-800/10 py-4">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="w-8 h-8 rounded-full object-cover border border-amber-800/20"
              />
              <div className="text-left">
                <span className="block font-bold text-[#3B1F0B] uppercase tracking-wider text-[11px]">
                  {post.author.name}
                </span>
                <span className="block text-[9px] text-neutral-500 font-medium">
                  {post.author.role}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-amber-800/15 hidden sm:block" />

            <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-widest text-neutral-500">
              <Clock className="w-3.5 h-3.5 text-amber-800" />
              <span>{post.readTime}</span>
            </div>

            <div className="h-6 w-px bg-amber-800/15 hidden sm:block" />

            <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-widest text-neutral-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Verified Authentic Sourcing</span>
            </div>
          </div>
        </div>

        {/* Hero Image */}
        <div className="max-w-5xl mx-auto mb-12 relative rounded-none overflow-hidden border border-amber-800/15 shadow-[0_15px_40px_rgba(28,18,12,0.06)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.heroImage}
            alt={post.title}
            className="w-full h-[360px] md:h-[520px] object-cover"
          />
          <div className="p-3 bg-[#3B1F0B] text-white text-[9px] tracking-widest font-semibold uppercase flex items-center justify-between">
            <span>Official Gharib Dubai Fragrance Intelligence</span>
            <span>Focus: {post.targetKeyword}</span>
          </div>
        </div>

        {/* Grid Layout: TOC Sidebar + Main Article HTML Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto">
          
          {/* Left Sticky Table of Contents Sidebar */}
          <aside className="lg:col-span-4">
            <div className="sticky top-28 bg-white p-6 border border-amber-800/15 shadow-[0_10px_30px_rgba(28,18,12,0.03)]">
              <div className="flex items-center gap-2 text-[#3B1F0B] pb-3 border-b border-amber-800/10 mb-4">
                <BookOpen className="w-4 h-4 text-amber-800" />
                <h3 className="text-xs font-bold uppercase tracking-widest">
                  Table of Contents
                </h3>
              </div>

              <nav className="space-y-2">
                {post.toc.map((item) => {
                  const isActive = activeTocId === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block text-[11px] font-bold tracking-wide transition-all py-1.5 px-3 border-l-2 ${
                        isActive
                          ? "border-amber-800 bg-amber-800/10 text-amber-900 font-extrabold translate-x-1"
                          : "border-transparent text-neutral-600 hover:text-[#3B1F0B] hover:border-amber-800/40"
                      }`}
                    >
                      {item.text}
                    </a>
                  );
                })}
              </nav>

              {/* Direct Buying Callout Banner */}
              <div className="mt-8 p-5 bg-[#FAF6F0] border border-amber-800/20 text-center">
                <Sparkles className="w-5 h-5 text-amber-800 mx-auto mb-2" />
                <h4 className="font-serif-luxury text-sm text-[#3B1F0B] mb-2">
                  Looking to Buy Authentic Perfume in Dubai?
                </h4>
                <p className="text-[10px] text-neutral-600 leading-relaxed mb-4">
                  Shop 100% factory-direct Arabian and niche fragrances with same-day Dubai express delivery.
                </p>
                <Link
                  href="/#new-in"
                  className="inline-flex items-center justify-center gap-2 bg-[#3B1F0B] text-white text-[9px] tracking-widest font-extrabold uppercase py-2.5 px-4 w-full hover:bg-amber-900 transition-colors"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Shop Verified Catalogue</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Main Article HTML Content */}
          <main className="lg:col-span-8 bg-white p-8 md:p-12 border border-amber-800/15 shadow-[0_10px_30px_rgba(28,18,12,0.03)] text-[#1C120C]">
            <div
              className="prose prose-stone max-w-none prose-headings:font-serif-luxury prose-headings:text-[#3B1F0B] prose-a:text-amber-800 prose-strong:text-[#3B1F0B]"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />

            {/* Author Bio Box */}
            <div className="mt-12 pt-8 border-t border-amber-800/15 bg-[#FAF6F0] p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-amber-800/30 shadow-md flex-shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-serif-luxury text-base text-[#3B1F0B] font-bold">
                    Written by {post.author.name}
                  </span>
                  <Award className="w-4 h-4 text-amber-800" />
                </div>
                <span className="block text-[10px] font-bold text-amber-900 tracking-wider uppercase mb-2">
                  {post.author.role}
                </span>
                <p className="text-xs text-neutral-600 leading-relaxed font-light">
                  Specializing in Middle Eastern perfumery heritage, factory batch authentication, and olfactory molecular chemistry in high-temperature desert climates.
                </p>
              </div>
            </div>

            {/* Internal Product Quick-Shop Section */}
            <div className="mt-12 p-8 bg-white border-2 border-amber-800/20">
              <h3 className="text-xl font-serif-luxury text-[#3B1F0B] mb-2 text-center">
                Featured Fragrances Mentioned in Article
              </h3>
              <p className="text-xs text-neutral-500 uppercase tracking-widest text-center mb-6">
                100% Authentic Factory-Sealed Stock • Express UAE Delivery
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {post.relatedProducts.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-[#FAF6F0] border border-amber-800/15 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="block text-[8px] text-amber-800 font-extrabold uppercase tracking-widest">
                        Official Direct Stock
                      </span>
                      <span className="block text-xs font-bold text-[#3B1F0B] uppercase tracking-wide">
                        {item}
                      </span>
                    </div>
                    <Link
                      href={`/?search=${encodeURIComponent(item)}`}
                      className="px-3 py-1.5 bg-[#3B1F0B] text-white text-[9px] font-bold uppercase tracking-wider hover:bg-amber-900 transition-colors flex-shrink-0"
                    >
                      Buy Online
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>

        {/* Bottom Related Articles */}
        <section className="max-w-6xl mx-auto mt-20 pt-12 border-t border-amber-800/15">
          <h2 className="text-2xl font-serif-luxury text-[#3B1F0B] text-center mb-8">
            Explore More Dubai Perfume Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedPosts.map((rPost) => (
              <div
                key={rPost.id}
                className="bg-white border border-amber-800/15 p-5 flex flex-col justify-between group hover:border-amber-800/40 transition-colors"
              >
                <div>
                  <div className="h-40 overflow-hidden mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rPost.heroImage}
                      alt={rPost.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <span className="text-[9px] font-bold text-amber-800 uppercase tracking-widest block mb-1">
                    {rPost.category}
                  </span>
                  <Link href={`/blogs/${rPost.slug}`}>
                    <h4 className="text-sm font-serif-luxury text-[#3B1F0B] line-clamp-2 hover:text-amber-800 transition-colors leading-tight mb-2">
                      {rPost.title}
                    </h4>
                  </Link>
                </div>
                <Link
                  href={`/blogs/${rPost.slug}`}
                  className="text-[9px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-1 mt-4"
                >
                  <span>Read Guide</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      </article>

      <Footer />
    </div>
  );
}
