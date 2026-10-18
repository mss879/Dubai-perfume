"use client";

import type { FeatureSettings } from "../lib/features";
import { useMinuteClock } from "../components/features/useMinuteClock";

export type RecipientChoice = { sendToOther: boolean; name: string; phone: string; date: string };

const dubaiDay = (ms: number) => new Date(ms + 4 * 3600_000).toISOString().slice(0, 10);

/** "Send to someone else": their name and phone, and a preferred delivery date (Admin → Send to someone else). */
export default function RecipientFields({
  settings,
  value,
  onChange,
}: {
  settings: FeatureSettings;
  value: RecipientChoice;
  onChange: (next: RecipientChoice) => void;
}) {
  const now = useMinuteClock();
  const set = (patch: Partial<RecipientChoice>) => onChange({ ...value, ...patch });
  const minDay = now === null ? undefined : dubaiDay(now + (Number(settings.min_days) || 0) * 86400_000);
  const maxDay = now === null ? undefined : dubaiDay(now + (Number(settings.max_days) || 30) * 86400_000);

  return (
    <div className="flex flex-col gap-6">
      <label className="flex cursor-pointer items-start gap-3 text-[14px] font-light text-black">
        <input type="checkbox" checked={value.sendToOther} onChange={(e) => set({ sendToOther: e.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-black" />
        <span>
          Send it to someone else
          <span className="mt-0.5 block text-[12px] text-[#646464]">We&rsquo;ll deliver to them, and keep you updated by email.</span>
        </span>
      </label>
      {value.sendToOther ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="recipientName" className="maison-label">
              Their name
            </label>
            <input id="recipientName" type="text" required maxLength={120} value={value.name} onChange={(e) => set({ name: e.target.value })} className="maison-input" />
          </div>
          <div>
            <label htmlFor="recipientPhone" className="maison-label">
              Their phone (for the courier)
            </label>
            <input id="recipientPhone" type="tel" maxLength={50} value={value.phone} onChange={(e) => set({ phone: e.target.value })} className="maison-input" placeholder="+971 50 123 4567" />
          </div>
          {settings.date_enabled !== false ? (
            <div>
              <label htmlFor="deliveryDate" className="maison-label">
                Preferred delivery date (optional)
              </label>
              <input id="deliveryDate" type="date" min={minDay} max={maxDay} value={value.date} onChange={(e) => set({ date: e.target.value })} className="maison-input" />
              <p className="pt-2 text-[12px] font-light text-[#646464]">We arrange it with the courier and confirm by email.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
