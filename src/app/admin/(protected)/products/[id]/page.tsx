import { cache } from "react";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { loadProductForm, type AdminProduct } from "../../../_lib/product-data";
import { Badge } from "../../../_ui/Badge";
import { ButtonLink } from "../../../_ui/Button";
import { PageHeader } from "../../../_ui/PageHeader";
import ProductForm, { type ProductFormInitial } from "../_components/ProductForm";

export const dynamic = "force-dynamic";

function productIdFrom(raw: string): number | null {
  if (!/^\d{1,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

// Shared by the page and its title, so the product is read once per request.
const loadForm = cache(async (id: number) => loadProductForm(await createSessionSupabase(), id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = productIdFrom((await params).id);
  const form = id ? await loadForm(id) : null;
  return { title: form?.product?.name || "Product" };
}

function toInitial(product: AdminProduct, collections: string[]): ProductFormInitial {
  return {
    id: product.id,
    brand: product.brand,
    name: product.name,
    olfactory_group: product.olfactoryGroup,
    price: product.price,
    compare_at_price: product.compareAtPrice,
    cost_price: product.costPrice,
    tagline: product.tagline,
    description: product.description,
    sizes: product.sizes,
    images: product.images,
    tags: product.tags,
    top_notes: product.topNotes,
    heart_notes: product.heartNotes,
    base_notes: product.baseNotes,
    is_new: product.isNew,
    is_bestseller: product.isBestseller,
    is_featured_large: product.isFeatured,
    is_published: product.isPublished,
    collections,
  };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = productIdFrom((await params).id);
  if (!id) notFound();
  await requireAdmin(`/admin/products/${id}`);

  const form = await loadForm(id);
  if (!form.product) notFound();
  const product = form.product;

  return (
    <>
      <PageHeader
        title={product.name || "Untitled product"}
        description={product.brand}
        back={{ href: "/admin/products", label: "Products" }}
        badges={product.isPublished ? null : <Badge tone="neutral">Hidden from shop</Badge>}
        actions={
          product.isPublished ? (
            <ButtonLink
              href={`/product/${product.id}`}
              target="_blank"
              rel="noopener"
              size="sm"
              icon={<ExternalLink className="h-4 w-4" aria-hidden />}
            >
              View in shop
            </ButtonLink>
          ) : null
        }
      />
      <ProductForm
        initial={toInitial(product, form.links)}
        stock={form.stock}
        collections={form.collections}
        brands={form.brands}
        families={form.families}
        migrationReady={form.ready}
      />
    </>
  );
}
