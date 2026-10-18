import { requireAdmin } from "../../../../lib/auth";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { loadProductForm } from "../../../_lib/product-data";
import { PageHeader } from "../../../_ui/PageHeader";
import ProductForm from "../_components/ProductForm";

export const metadata = { title: "Add product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireAdmin("/admin/products/new");
  const supabase = await createSessionSupabase();
  const form = await loadProductForm(supabase, null);

  return (
    <>
      <PageHeader
        title="Add product"
        description="Fill in the basics, the price and how many bottles you have. You can change everything later."
        back={{ href: "/admin/products", label: "Products" }}
      />
      <ProductForm
        initial={null}
        stock={[]}
        collections={form.collections}
        brands={form.brands}
        families={form.families}
        migrationReady={form.ready}
      />
    </>
  );
}
