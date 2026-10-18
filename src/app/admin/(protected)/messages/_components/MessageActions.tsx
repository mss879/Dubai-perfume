"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Send, Trash2 } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Button } from "../../../_ui/Button";
import { ConfirmDialog, Dialog } from "../../../_ui/Dialog";
import { Field, Textarea } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";

export type MessageSummary = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  answered: boolean;
};

/** Reply by email, mark answered (or reopen), delete. */
export default function MessageActions({ inquiry }: { inquiry: MessageSummary }) {
  const router = useRouter();
  const toast = useToast();
  const [refreshing, startTransition] = useTransition();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => startTransition(() => router.refresh());

  const send = async () => {
    const reply = text.trim();
    if (reply.length < 2) {
      setError("Write your reply first.");
      return;
    }
    setSending(true);
    setError(null);
    const result = await adminFetch<{ emailed?: string; warning?: string }>(
      "/api/admin/inquiry-reply",
      "POST",
      { inquiryId: inquiry.id, reply },
      "The reply could not be sent."
    );
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReplying(false);
    setText("");
    toast(result.data.warning ?? `Reply sent to ${result.data.emailed ?? inquiry.email}.`, result.data.warning ? "info" : "success");
    refresh();
  };

  const mark = async () => {
    setMarking(true);
    const status = inquiry.answered ? "new" : "answered";
    const result = await adminFetch("/api/admin/inquiry-reply", "POST", { inquiryId: inquiry.id, status });
    setMarking(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(status === "answered" ? "Marked as answered." : "Moved back to unanswered.");
    refresh();
  };

  const destroy = async () => {
    setDeleting(true);
    const result = await adminFetch(`/api/admin/inquiries/${inquiry.id}`, "DELETE", undefined, "The message could not be deleted.");
    setDeleting(false);
    setConfirmDelete(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Message deleted.");
    refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={inquiry.answered ? "secondary" : "primary"}
        icon={<Send className="h-3.5 w-3.5" aria-hidden />}
        onClick={() => {
          setError(null);
          setReplying(true);
        }}
      >
        {inquiry.answered ? "Reply again" : "Reply"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        busy={marking || refreshing}
        icon={inquiry.answered ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
        onClick={mark}
      >
        {inquiry.answered ? "Mark unanswered" : "Mark answered"}
      </Button>
      <Button
        size="sm"
        variant="plain"
        className="text-red-700 hover:bg-red-50 hover:text-red-800"
        icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
        onClick={() => setConfirmDelete(true)}
      >
        Delete
      </Button>

      <Dialog
        open={replying}
        onClose={() => setReplying(false)}
        dismissable={!sending}
        wide
        title={`Reply to ${inquiry.name || inquiry.email}`}
        description={
          <>
            Sent by email to <strong className="font-medium text-neutral-900">{inquiry.email}</strong>, with their message
            quoted below your reply.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplying(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} busy={sending} icon={<Send className="h-4 w-4" aria-hidden />}>
              Send reply
            </Button>
          </>
        }
      >
        <div className="mb-4 rounded-lg bg-neutral-50 px-4 py-3">
          <p className="text-[13px] font-medium text-neutral-500">{inquiry.subject}</p>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-800">{inquiry.message}</p>
        </div>
        <Field label="Your reply" error={error}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              rows={7}
              maxLength={5000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this message?"
        description={`The message from ${inquiry.name || inquiry.email} is removed for good. This can't be undone.`}
        confirmLabel="Delete message"
        confirmVariant="critical"
        busy={deleting}
        onConfirm={destroy}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
