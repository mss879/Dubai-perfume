"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Clock, ArrowRight, BookOpen, Sparkles, UserCheck } from "lucide-react";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { BLOG_POSTS, BlogPost } from "../data/blogPosts";
import { clientSafeSupabase } from "../lib/supabase";

export default function BlogsPage() {
  const [postsList, setPostsList] = useState<BlogPost[]>(BLOG_POSTS);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    const fetchDbBlogs = async () => {
      try {
        const { data, error } = await clientSafeSupabase
          .from("blog_posts")
          .select("*")
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          const dbMapped: BlogPost[] = data.map((item: any) => ({
            id: String(item.id),
            title: item.title,
            slug: item.slug,
            metaTitle: item.title,
            metaDescription: item.summary || item.title,
            category: "Heritage & Artistry",
            publishDate: new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            readTime: "5 min read",
            excerpt: item.summary || (item.content ? item.content.replace(/<[^>]+>/g, "").slice(0, 140) + "..." : ""),
            heroImage: item.cover_image || "/bento-oud-imperial.png",
            author: {
              name: item.author || "Gharib Master Perfumer",
              role: "Olfactory Specialist",
              avatar: "/bento-oud-imperial.png"
            },
            targetKeyword: item.title,
            contentHtml: item.content,
            toc: [],
            faqs: [],
            relatedProducts: []
          }));
          // Combine DB posts first, then static fallbacks without duplicate slugs
          const dbSlugs = new Set(dbMapped.map(p => p.slug));
          const staticFiltered = BLOG_POSTS.filter(p => !dbSlugs.has(p.slug));
          setPostsList([...dbMapped, ...staticFiltered]);
        }
      } catch (err) {
        console.error("Failed to fetch blog posts from Supabase:", err);
      }
    };
    fetchDbBlogs();
  }, []);

  const categories = ["All", "Buying Guide", "Fragrance Performance", "Brand Spotlights", "Heritage & Artistry"];

  const filteredPosts = postsList.filter((post) => {
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.targetKeyword.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredPost = postsList[0];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1C120C] flex flex-col justify-between font-sans-luxury relative overflow-x-hidden pt-20">
      {/* Shared Unified White Navbar */}
      <AppHeader activePage="blogs" />

      {/* Hero Section */}
      <section className="relative py-16 px-6 md:px-12 max-w-[1440px] mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-800/10 border border-amber-800/20 text-amber-900 text-[10px] tracking-[0.25em] font-extrabold uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Olfactory Journal</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-serif-luxury text-[#3B1F0B] tracking-tight leading-tight mb-4">
            Dubai Perfume Insights & Authenticity Guides
          </h1>
          <p className="text-xs md:text-sm text-neutral-600 tracking-wider leading-relaxed uppercase font-light max-w-2xl mx-auto">
            Expert editorial guides on buying authentic perfumes online in Dubai, beast-mode long-lasting notes, brand spotlights, and Middle Eastern perfumery heritage.
          </p>
        </div>

        {/* Featured Post Card */}
        {featuredPost && (
          <div className="mb-16 bg-white border border-amber-800/15 shadow-[0_15px_40px_rgba(28,18,12,0.05)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 group">
            <div className="lg:col-span-7 relative min-h-[340px] lg:min-h-[460px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredPost.heroImage}
                alt={featuredPost.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute top-6 left-6 bg-[#3B1F0B] text-white text-[9px] tracking-widest font-bold uppercase py-1.5 px-4 shadow-md">
                Featured Editorial
              </div>
            </div>
            <div className="lg:col-span-5 p-8 md:p-12 flex flex-col justify-between bg-white">
              <div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-amber-800 tracking-widest uppercase mb-3">
                  <span>{featuredPost.category}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {featuredPost.readTime}
                  </span>
                </div>
                <Link href={`/blogs/${featuredPost.slug}`}>
                  <h2 className="text-2xl md:text-3xl font-serif-luxury text-[#3B1F0B] hover:text-amber-800 transition-colors leading-snug mb-4">
                    {featuredPost.title}
                  </h2>
                </Link>
                <p className="text-xs text-neutral-600 leading-relaxed tracking-wide mb-6">
                  {featuredPost.excerpt}
                </p>
              </div>

              <div className="pt-6 border-t border-amber-800/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featuredPost.author.avatar}
                    alt={featuredPost.author.name}
                    className="w-10 h-10 rounded-full object-cover border border-amber-800/20"
                  />
                  <div>
                    <span className="block text-[11px] font-bold text-[#3B1F0B] uppercase tracking-wider">
                      {featuredPost.author.name}
                    </span>
                    <span className="block text-[9px] text-neutral-500 font-medium">
                      {featuredPost.publishDate}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/blogs/${featuredPost.slug}`}
                  className="inline-flex items-center gap-2 text-[11px] font-bold text-amber-800 hover:text-amber-900 tracking-widest uppercase transition-colors"
                >
                  <span>Read Article</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 border-b border-amber-800/15 pb-8">
          {/* Categories */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition-all duration-300 cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#3B1F0B] text-white shadow-md"
                    : "bg-white border border-amber-800/15 text-neutral-700 hover:border-amber-800/40 hover:text-[#3B1F0B]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blogs & keywords..."
              className="w-full bg-white border border-amber-800/15 pl-10 pr-4 py-2.5 text-xs text-neutral-800 outline-none focus:border-amber-800 transition-colors uppercase font-medium placeholder-neutral-400"
            />
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {filteredPosts.map((post) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white border border-amber-800/15 shadow-[0_10px_30px_rgba(28,18,12,0.03)] flex flex-col justify-between overflow-hidden group"
            >
              <div>
                <div className="relative h-56 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.heroImage}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-[#3B1F0B] text-[8px] tracking-widest font-extrabold uppercase py-1 px-3 border border-amber-800/20">
                    {post.category}
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 text-[9px] font-semibold text-neutral-500 uppercase tracking-widest mb-3">
                    <Clock className="w-3 h-3 text-amber-800" />
                    <span>{post.readTime}</span>
                    <span>•</span>
                    <span>{post.publishDate}</span>
                  </div>

                  <Link href={`/blogs/${post.slug}`}>
                    <h3 className="text-lg font-serif-luxury text-[#3B1F0B] hover:text-amber-800 transition-colors leading-snug mb-3 line-clamp-2">
                      {post.title}
                    </h3>
                  </Link>

                  <p className="text-xs text-neutral-600 leading-relaxed line-clamp-3 mb-4">
                    {post.excerpt}
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6 pt-0 flex items-center justify-between border-t border-neutral-100 mt-auto pt-4">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.author.avatar}
                    alt={post.author.name}
                    className="w-7 h-7 rounded-full object-cover border border-amber-800/20"
                  />
                  <span className="text-[10px] font-bold text-[#3B1F0B] uppercase tracking-wider">
                    {post.author.name}
                  </span>
                </div>

                <Link
                  href={`/blogs/${post.slug}`}
                  className="text-[10px] font-bold text-amber-800 hover:text-amber-900 uppercase tracking-widest flex items-center gap-1"
                >
                  <span>Read</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
