"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { formatNis } from "@/lib/formatMoney";

type Row = { label: string; netNis: number; cumulative: number };

/** Recharts takes raw SVG paint values, so theme it through the same CSS tokens as the page. */
const TICK = { fontSize: 11, fill: "var(--fp-secondary)" };
const AXIS_LINE = {
  stroke: "color-mix(in srgb, var(--fp-wood-mid) 60%, transparent)",
};
const GRID_STROKE = "color-mix(in srgb, var(--fp-wood-mid) 35%, transparent)";
const LINE_STROKE = "var(--fp-moss-ink)";

function valueToneClass(n: number): string {
  if (n < 0) return "text-[var(--fp-loss-ink)]";
  if (n > 0) return "text-[var(--fp-moss-ink)]";
  return "text-[var(--fp-ink)]";
}

export function CareerChart({ data }: { data: Row[] }) {
  const t = useTranslations("career");
  const locale = useLocale();

  if (data.length === 0) return null;

  return (
    <div className="mt-6 h-56 w-full rounded-xl border border-[var(--fp-wood-mid)]/25 bg-[var(--fp-panel)] p-3">
      <p className="mb-2 text-center text-sm font-medium">{t("chartTitle")}</p>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={TICK} axisLine={AXIS_LINE} tickLine={AXIS_LINE} />
          <YAxis tick={TICK} axisLine={AXIS_LINE} tickLine={AXIS_LINE} />
          <Tooltip
            cursor={{ stroke: GRID_STROKE }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const raw = payload[0].value;
              const n = typeof raw === "number" ? raw : Number(raw);
              const safe = Number.isFinite(n) ? n : 0;
              return (
                <div
                  className="rounded-lg border px-3 py-2 text-sm shadow-md"
                  style={{
                    backgroundColor: "var(--fp-panel)",
                    borderColor: "color-mix(in srgb, var(--fp-wood-mid) 35%, transparent)",
                    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
                  }}
                >
                  {label != null && (
                    <p className="mb-1 font-semibold text-[var(--fp-ink)]">{label}</p>
                  )}
                  <p
                    className={`text-base font-semibold tabular-nums ${valueToneClass(safe)}`}
                    dir="ltr"
                  >
                    {formatNis(locale, safe)}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke={LINE_STROKE}
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--fp-panel)", stroke: LINE_STROKE, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
