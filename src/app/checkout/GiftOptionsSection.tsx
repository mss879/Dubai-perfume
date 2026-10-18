"use client";

import type { FeatureSettings } from "../lib/features";
import { useCurrency } from "../lib/currency";

const HAIRLINE = "rgba(0,0,0,0.12)";

export type GiftChoice = { isGift: boolean; wrap: boolean; message: string; hidePrices: boolean };

/** "This is a gift": wrap, a message, and a slip without prices (Admin → Gift wrap & message). */
export default function GiftOptionsSection({
  settings,
  value,
  onChange,
  wrapIncluded,
}: {
  settings: FeatureSettings;
  value: GiftChoice;
  onChange: (next: GiftChoice) => void;
  /** A gift box offer in the bag already wraps the order. */
  wrapIncluded: boolean;
}) {
  const { format } = useCurrency();
  const price = Number(settings.wrap_price) || 0;
  const max = Number(settings.message_max) || 250;
  const set = (patch: Partial<GiftChoice>) => onChange({ ...value, ...patch });

  return (
    <section>
      <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        Gift options
      </h2>
      <div className="flex flex-col gap-5 pt-8">
        <label className="flex cursor-pointer items-start gap-3 text-[14px] font-light text-black">
          <input type="checkbox" checked={value.isGift} onChange={(e) => set({ isGift: e.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-black" />
          <span>This order is a gift</span>
        </label>

        {value.isGift ? (
          <div className="flex flex-col gap-5 pl-7">
            {settings.wrap_enabled !== false ? (
              <label className="flex cursor-pointer items-start gap-3 text-[14px] font-light text-black">
                <input
                  type="checkbox"
                  checked={value.wrap || wrapIncluded}
                  disabled={wrapIncluded}
                  onChange={(e) => set({ wrap: e.target.checked })}
                  className="mt-1 h-4 w-4 shrink-0 accent-black"
                />
                <span>
                  Gift-wrap it{" "}
                  <span className="text-[#646464]">
                    {wrapIncluded ? "(included with your gift box)" : price > 0 ? `(+${format(price)})` : "(complimentary)"}
                  </span>
                  {settings.wrap_note ? <span className="mt-0.5 block text-[12px] text-[#646464]">{String(settings.wrap_note)}</span> : null}
                </span>
              </label>
            ) : null}

            {settings.message_enabled !== false ? (
              <div>
                <label htmlFor="giftMessage" className="maison-label">
                  Gift message (optional)
                </label>
                <textarea
                  id="giftMessage"
                  rows={3}
                  maxLength={max}
                  value={value.message}
                  onChange={(e) => set({ message: e.target.value })}
                  placeholder="Happy birthday, with love"
                  className="maison-input"
                  style={{ height: "auto", paddingTop: 12, paddingBottom: 12 }}
                />
                <p className="pt-2 text-[12px] font-light text-[#646464]">
                  Included on a card in the parcel. {value.message.length}/{max}
                </p>
              </div>
            ) : null}

            {settings.hide_prices_enabled !== false ? (
              <label className="flex cursor-pointer items-start gap-3 text-[14px] font-light text-black">
                <input type="checkbox" checked={value.hidePrices} onChange={(e) => set({ hidePrices: e.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-black" />
                <span>Leave the prices off the packing slip</span>
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
