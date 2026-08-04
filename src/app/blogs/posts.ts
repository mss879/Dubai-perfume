import "server-only";
import { cache } from "react";
import { BLOG_POSTS, BlogPost } from "../data/blogPosts";
import { createServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";

/** Shape of a row in public.blog_posts. */
interface BlogPostRow {
  id: string | number;
  title: string;
  slug: string;
  summary?: string | null;
  content?: string | null;
  cover_image?: string | null;
  author?: string | null;
  created_at: string;
}

/** A fragrance named in the copy that was matched to a real row in public.products. */
export interface MentionedProduct {
  id: number;
  name: string;
  brand: string | null;
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function mapRowToPost(row: BlogPostRow): BlogPost {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    metaTitle: row.title,
    metaDescription: row.summary || row.title,
    category: "Heritage & Artistry",
    publishDate: new Date(row.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    datePublished: row.created_at,
    dateModified: row.created_at,
    readTime: "5 min read",
    excerpt:
      row.summary ||
      (row.content ? row.content.replace(/<[^>]+>/g, "").slice(0, 140) + "..." : ""),
    heroImage: row.cover_image || "/bento-oud-imperial.png",
    author: {
      name: row.author || "Gharib Master Perfumer",
      role: "Olfactory Specialist",
      avatar: "/bento-oud-imperial.png",
    },
    targetKeyword: row.title,
    contentHtml: row.content || "",
    toc: [],
    faqs: [],
    relatedProducts: [],
  };
}

/**
 * Published journal entries: live rows from public.blog_posts first, then the
 * static editorial posts that no DB row has replaced (DB rows win on slug).
 */
export const getAllPosts = cache(async (): Promise<BlogPost[]> => {
  if (!isSupabaseConfigured) return BLOG_POSTS;
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return BLOG_POSTS;

    const dbMapped = (data as BlogPostRow[]).map(mapRowToPost);
    const dbSlugs = new Set(dbMapped.map((p) => p.slug));
    const staticFiltered = BLOG_POSTS.filter((p) => !dbSlugs.has(p.slug));
    return [...dbMapped, ...staticFiltered];
  } catch {
    return BLOG_POSTS;
  }
});

/** Resolve one journal entry by slug. A published DB row wins over the static list. */
export const getPostBySlug = cache(async (slug: string): Promise<BlogPost | undefined> => {
  if (isSupabaseConfigured) {
    try {
      const supabase = createServerSupabase();
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (!error && data) return mapRowToPost(data as BlogPostRow);
    } catch {
      // Fall through to the static list below.
    }
  }
  return BLOG_POSTS.find((p) => p.slug === slug);
});

/**
 * Resolve the fragrances named in a story against public.products. Anything
 * the shop does not actually carry is dropped rather than linked to nothing.
 */
export const getMentionedProducts = cache(
  async (names: readonly string[]): Promise<MentionedProduct[]> => {
    if (names.length === 0 || !isSupabaseConfigured) return [];
    try {
      const supabase = createServerSupabase();
      const { data, error } = await supabase.from("products").select("id, name, brand");
      if (error || !Array.isArray(data)) return [];

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
      return resolved;
    } catch {
      return [];
    }
  }
);
