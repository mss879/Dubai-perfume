import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import { SITE_URL, SITE_NAME } from "../../lib/site";
import { jsonLdScript } from "../../lib/html";
import { getAllPosts, getPostBySlug, getMentionedProducts } from "../posts";
import ArticleToc from "./ArticleToc";
import ShareRow from "./ShareRow";

export const dynamic = "force-dynamic";

const absoluteUrl = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    return { title: "Article Not Found" };
  }
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    alternates: { canonical: `/blogs/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.metaTitle,
      description: post.metaDescription,
      url: `${SITE_URL}/blogs/${post.slug}`,
      images: [absoluteUrl(post.heroImage)],
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const mentionedProducts = await getMentionedProducts(post.relatedProducts);
  // Read through getAllPosts() so published DB articles appear in the rail —
  // reading BLOG_POSTS directly always showed the four built-in posts.
  const allPosts = await getAllPosts();
  const relatedPosts = allPosts.filter((p) => p.slug !== post.slug).slice(0, 3);
  const canonicalUrl = `${SITE_URL}/blogs/${post.slug}`;

  // Structured Schema.org JSON-LD, emitted from the server with per-post dates.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.metaTitle,
    description: post.metaDescription,
    image: [absoluteUrl(post.heroImage)],
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    author: {
      "@type": "Person",
      name: post.author.name,
      jobTitle: post.author.role,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };

  const faqSchema =
    post.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.answer,
            },
          })),
        }
      : null;

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Schema.org Structured Data Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(faqSchema) }}
        />
      )}

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

            {/* Contents (client island: scroll-spy highlight) */}
            <ArticleToc toc={post.toc} />

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
                <Link href="/shop" className="maison-btn-outline">
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

            {/* Share (client island) */}
            <ShareRow title={post.title} canonicalUrl={canonicalUrl} />
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
