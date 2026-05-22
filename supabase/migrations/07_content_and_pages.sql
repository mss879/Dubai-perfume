-- Create cms_pages table
CREATE TABLE IF NOT EXISTS public.cms_pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(255) DEFAULT 'Gharib Editorial Team',
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    cover_image VARCHAR(512),
    author VARCHAR(255) DEFAULT 'Gharib Master Perfumer',
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Allow public reads
CREATE POLICY "Allow public read on cms_pages" ON public.cms_pages FOR SELECT USING (true);
CREATE POLICY "Allow public read on blog_posts" ON public.blog_posts FOR SELECT USING (true);

-- Seed Pages
INSERT INTO public.cms_pages (title, slug, content) VALUES
('About Gharib', 'about-us', '<h2>The Legacy of Gharib</h2><p>Since 1993, Gharib has been at the forefront of curating and blending the finest luxury perfumes in Dubai. Rooted in centuries-old Arabian blending traditions combined with Parisian refinement, each bottle represents an elegant masterpiece of olfactory art.</p>'),
('Scent Layering Guide', 'scent-layering', '<h2>Art of Fragrance Layering</h2><p>Discover the ancient secret of combining ouds, florals, and musks. Scent layering is a personal signature ritual. Start with a heavy woody base, let it warm on your pulse points, and mist a lighter floral or citrus notes to add dimension.</p>')
ON CONFLICT (slug) DO NOTHING;

-- Seed Blog Posts
INSERT INTO public.blog_posts (title, slug, summary, content, cover_image) VALUES
('The Secret Life of Cambodian Oud', 'cambodian-oud-secrets', 'Unveiling the rare harvesting process of the world''s most precious liquid gold.', '<p>Oud, or agarwood, is referred to as wood of the gods. In the deep forests of Cambodia, our scent scouts seek out infected Aquilaria trees. It is only when the tree fights a microscopic wild mold that it yields the rich, heavy dark resin known as Oud...</p>', '/bento-oud-imperial.png'),
('Top Summer Scent Notes for 2026', 'summer-scents-2026', 'A look at the crisp marine minerals, salty mints, and light ambroxan notes trending this season.', '<p>As the temperatures rise in Dubai, heavy ouds transition beautifully when layered with fresh aquatic elements. Ocean Breeze is leading our curation, blending salty Italian bergamot with refreshing mint leaves and rich coastal minerals...</p>', '/campaign-blue.png')
ON CONFLICT (slug) DO NOTHING;
