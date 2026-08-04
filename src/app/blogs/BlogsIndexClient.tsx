"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
// Type-only: keeps the 612-line static post module out of the client bundle.
import type { BlogPost } from "../data/blogPosts";

const CATEGORIES = [
  "All",
  "Buying Guide",
  "Fragrance Performance",
  "Brand Spotlights",
  "Heritage & Artistry",
];

export default function BlogsIndexClient({ posts }: { posts: BlogPost[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredPosts = posts.filter((post) => {
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.targetKeyword.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // The lead story only heads the page while the reader is browsing everything;
  // once a category or a search narrows the list, every match sits in the grid.
  const isBrowsingAll = selectedCategory === "All" && searchQuery.trim() === "";
  const featuredPost = isBrowsingAll ? posts[0] : undefined;
  const gridPosts = featuredPost
    ? filteredPosts.filter((post) => post.id !== featuredPost.id)
    : filteredPosts;

  return (
    <>
      {/* Masthead */}
      <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
        <p className="maison-eyebrow">The Journal</p>
        <h1 className="maison-page-title mt-5">
          Dubai Perfume Insights &amp; Authenticity Guides
        </h1>
        <p className="mx-auto mt-6 max-w-[60ch] text-[15px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
          Editorial guides on buying authentic perfume online in Dubai, longevity in desert heat,
          brand spotlights, and the heritage of Middle Eastern perfumery.
        </p>
      </section>

      {/* Lead story */}
      {featuredPost && (
        <section className="maison-container pb-14 md:pb-20">
          <Link href={`/blogs/${featuredPost.slug}`} className="group block overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={featuredPost.heroImage}
              alt={featuredPost.title}
              className="w-full h-[280px] md:h-[560px] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          </Link>

          <div className="mx-auto mt-10 max-w-[60ch] text-center">
            <Link href={`/blogs/${featuredPost.slug}`}>
              <h2 className="font-display uppercase text-[22px] md:text-[28px] leading-[1.25] tracking-[0.08em] text-black transition-opacity duration-300 hover:opacity-60">
                {featuredPost.title}
              </h2>
            </Link>

            <p className="maison-eyebrow mt-5">
              {featuredPost.publishDate} — {featuredPost.category}
            </p>

            <p className="mt-6 text-[15px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
              {featuredPost.excerpt}
            </p>

            <div className="mt-8">
              <Link href={`/blogs/${featuredPost.slug}`} className="maison-link">
                Read the story
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Filter + search rail */}
      <div className="maison-container">
        <div className="flex flex-col gap-5 border-y border-[rgba(0,0,0,0.12)] py-5 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`cursor-pointer border-b pb-1 text-[12px] uppercase tracking-[0.1em] transition-colors duration-300 ${
                  selectedCategory === cat
                    ? "border-black text-black"
                    : "border-transparent text-[#646464] hover:text-black"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-[280px] md:shrink-0">
            <Search
              strokeWidth={1.25}
              className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#646464]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the journal"
              className="w-full border-b border-[rgba(0,0,0,0.12)] bg-transparent py-2 pl-7 text-[12px] font-light uppercase tracking-[0.08em] text-black outline-none transition-colors duration-300 placeholder:text-[#757575] focus:border-black"
            />
          </div>
        </div>
      </div>

      {/* Story grid */}
      <section className="maison-container maison-section">
        {gridPosts.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="font-display uppercase text-[20px] tracking-[0.1em] text-black">
              No stories match your search
            </h2>
            <p className="mx-auto mt-6 max-w-[46ch] text-[14px] font-light leading-[1.75] text-[#646464]">
              Try another category, or clear the search to read the whole journal.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="maison-btn-outline h-12 px-10 mt-8 inline-flex items-center"
            >
              Show every story
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
            {gridPosts.map((post) => (
              <article key={post.id} className="group flex flex-col">
                <Link href={`/blogs/${post.slug}`} className="block overflow-hidden">
                  <div className="w-full aspect-[3/2] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.heroImage}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  </div>
                </Link>

                <p className="maison-eyebrow mt-6">
                  {post.publishDate} — {post.category}
                </p>

                <Link href={`/blogs/${post.slug}`}>
                  <h2 className="mt-3 font-display uppercase text-[18px] leading-[1.3] tracking-[0.08em] text-black transition-opacity duration-300 group-hover:opacity-60">
                    {post.title}
                  </h2>
                </Link>

                <p className="mt-4 text-[14px] font-light leading-[1.8] text-[rgba(0,0,0,0.75)]">
                  {post.excerpt}
                </p>

                <div className="mt-auto pt-6">
                  <Link href={`/blogs/${post.slug}`} className="maison-link">
                    Read
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
