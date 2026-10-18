"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { COVER_PRESETS, DEFAULT_COVER, collectionSchema } from "../../../_lib/collection-schema";
import { uploadCollectionCover } from "../../../_lib/image-upload";
import { Button } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { ConfirmDialog } from "../../../_ui/Dialog";
import { Field, Input, Textarea } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import { cn } from "../../../_ui/cn";

export type CollectionFormInitial = {
  id: string;
  title: string;
  description: string;
  cover: string;
  automated: boolean;
  tag: string;
  kind: "brand" | "line" | "curated";
};

export default function CollectionForm({
  initial,
  tagCounts,
}: {
  initial: CollectionFormInitial | null;
  tagCounts: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cover, setCover] = useState(initial?.cover || DEFAULT_COVER);
  const [automated, setAutomated] = useState(initial?.automated ?? false);
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const cleanTag = tag.trim().toLowerCase();
  const matching = cleanTag ? (tagCounts[cleanTag] ?? 0) : 0;
  const knownTags = Object.keys(tagCounts).sort();
  const changedRule = initial !== null && (automated !== initial.automated || (automated && cleanTag !== initial.tag));

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setUploading(true);
    const result = await uploadCollectionCover(file);
    setUploading(false);
    if (result.ok) setCover(result.url);
    else toast(result.error, "error");
  };

  const save = async () => {
    setFormError(null);
    const payload = { title, description, cover_image: cover, type: automated ? "automated" : "manual", tag: automated ? tag : "" };
    const checked = collectionSchema.safeParse(payload);
    if (!checked.success) {
      const next: Record<string, string> = {};
      for (const issue of checked.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    const result = initial
      ? await adminFetch<{ warning?: string }>(`/api/admin/collections/${encodeURIComponent(initial.id)}`, "PATCH", checked.data, "The collection could not be saved.")
      : await adminFetch<{ id?: string; warning?: string }>("/api/admin/collections", "POST", checked.data, "The collection could not be created.");
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    const warning = result.data.warning;
    toast(warning ?? (initial ? "Collection saved." : `${checked.data.title} created.`), warning ? "error" : "success");
    const newId = (result.data as { id?: string }).id;
    if (!initial && newId) router.replace(`/admin/collections/edit/${encodeURIComponent(newId)}`);
    else startTransition(() => router.refresh());
  };

  const destroy = async () => {
    if (!initial) return;
    setDeleting(true);
    const result = await adminFetch(`/api/admin/collections/${encodeURIComponent(initial.id)}`, "DELETE", undefined, "The collection could not be deleted.");
    setDeleting(false);
    if (!result.ok) {
      setConfirmDelete(false);
      toast(result.error, "error");
      return;
    }
    toast(`${initial.title} deleted.`);
    router.replace("/admin/collections");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Details" />
        <CardBody className="flex flex-col gap-4">
          <Field label="Name" required error={errors.title} hint={initial ? undefined : "Also becomes its web address. It can't be changed later."}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            )}
          </Field>
          <Field label="Description" hint="A sentence or two shown at the top of the collection's page." error={errors.description}>
            {({ id, describedBy, invalid }) => (
              <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-medium text-neutral-800">Cover picture</span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
              <img src={cover || DEFAULT_COVER} alt="Cover preview" className="aspect-[4/3] w-full max-w-[220px] rounded-lg border border-neutral-200 object-cover" />
              <div className="flex flex-col gap-2">
                <input ref={fileInput} id="collection-cover" type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files)} />
                <label
                  htmlFor="collection-cover"
                  className={cn(
                    "inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg bg-white px-4 text-[14px] font-medium text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50",
                    uploading && "pointer-events-none opacity-50"
                  )}
                >
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  {uploading ? "Uploading…" : "Upload a picture"}
                </label>
                <p className="text-[13px] text-neutral-500">Or use one of the house pictures:</p>
                <div className="flex flex-wrap gap-2">
                  {COVER_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCover(preset.value)}
                      aria-pressed={cover === preset.value}
                      title={preset.label}
                      className={cn(
                        "overflow-hidden rounded-md ring-offset-2 focus-visible:outline-2 focus-visible:outline-blue-600",
                        cover === preset.value ? "ring-2 ring-neutral-900" : "ring-1 ring-neutral-200"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- tiny preset swatch */}
                      <img src={preset.value} alt={preset.label} className="h-10 w-14 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {errors.cover_image ? <p className="text-[13px] font-medium text-red-700">{errors.cover_image}</p> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Which perfumes are in it" />
        <CardBody className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="How products are chosen" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { value: false, label: "Hand-picked", note: "You choose each perfume below." },
              { value: true, label: "By tag", note: "Every perfume with a tag joins, now and later." },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={automated === option.value}
                onClick={() => setAutomated(option.value)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                  automated === option.value ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"
                )}
              >
                <span className="block text-[15px] font-medium text-neutral-900">{option.label}</span>
                <span className="block text-[13px] text-neutral-500">{option.note}</span>
              </button>
            ))}
          </div>
          {automated ? (
            <Field
              label="Tag"
              required
              error={errors.tag}
              hint={cleanTag ? `${matching} perfume${matching === 1 ? "" : "s"} carry this tag right now.` : "Tags are set on each product's page."}
            >
              {({ id, describedBy, invalid }) => (
                <>
                  <Input id={id} aria-describedby={describedBy} invalid={invalid} list="collection-tags" value={tag} maxLength={50} onChange={(e) => setTag(e.target.value)} placeholder="e.g. oud" />
                  <datalist id="collection-tags">
                    {knownTags.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
          ) : null}
          {changedRule && automated ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
              Saving replaces this collection&rsquo;s products with the {matching} perfume{matching === 1 ? "" : "s"} tagged &ldquo;{cleanTag || "…"}&rdquo;.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {initial ? (
          <Button variant="plain" className="text-red-700 hover:bg-red-50 hover:text-red-800" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>
            Delete collection
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {formError ? (
            <p role="alert" className="text-[14px] font-medium text-red-700">
              {formError}
            </p>
          ) : null}
          <Button variant="secondary" onClick={() => router.push("/admin/collections")} disabled={saving}>
            {initial ? "Back" : "Cancel"}
          </Button>
          <Button onClick={save} busy={saving || refreshing} disabled={uploading}>
            {initial ? "Save collection" : "Create collection"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${initial?.title ?? "this collection"}?`}
        description={
          initial?.kind === "brand"
            ? "This is a brand page. Its page disappears from the shop; the perfumes themselves stay. This can't be undone."
            : "Its page disappears from the shop; the perfumes themselves stay. This can't be undone."
        }
        confirmLabel="Delete collection"
        confirmVariant="critical"
        busy={deleting}
        onConfirm={destroy}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
