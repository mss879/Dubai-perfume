import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/site";
import { createServerSupabase, isSupabaseConfigured } from "./lib/supabase-server";
import { getAllPosts } from "./blogs/posts";

/**
 * Rebuilt hourly. Without this the sitemap is baked at build time, so products
 * and articles added afterwards never appear until the next deploy.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/collections`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/discover`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/blogs`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/track`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/returns`, changeFrequency: "yearly", priority: 0.2 },
  ];

  if (!isSupabaseConfigured) {
    return staticRoutes;
  }

  try {
    const supabase = createServerSupabase();
    // getAllPosts() merges the published DB rows with the built-in editorial
    // posts, so the static slugs that /blogs/[slug] serves are listed too —
    // querying blog_posts directly used to omit them.
    const [products, collections, posts] = await Promise.all([
      supabase.from("products").select("id"),
      supabase.from("collections").select("id"),
      getAllPosts(),
    ]);

    const productRoutes: MetadataRoute.Sitemap = (products.data ?? []).map((p: { id: number }) => ({
      url: `${SITE_URL}/product/${p.id}`,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    const collectionRoutes: MetadataRoute.Sitemap = (collections.data ?? []).map(
      (c: { id: string }) => ({
        url: `${SITE_URL}/collection/${c.id}`,
        changeFrequency: "weekly",
        priority: 0.7,
      })
    );
    const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `${SITE_URL}/blogs/${post.slug}`,
      changeFrequency: "monthly",
      priority: 0.5,
    }));

    return [...staticRoutes, ...productRoutes, ...collectionRoutes, ...blogRoutes];
  } catch {
    return staticRoutes;
  }
}
