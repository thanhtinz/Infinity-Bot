import type { ReactNode } from "react";
import type { FormState } from "./embedTypes";
import { EMBED_EVENTS } from "./embedEvents";
import { DEFAULTS } from "./embedDefaults";
import { useT } from "@/i18n";

export const DUMMY: Record<string, string> = {
  "{user}": "John Doe",
  "{user.mention}": "@JohnDoe",
  "{user.id}": "123456789012345678",
  "{order.id}": "#12345",
  "{order.total}": "100,000",
  "{product.name}": "Package VIP 30 days",
  "{package}": "VIP 30 days + Bonus",
  "{date}": "14/05/2026 15:30",
  "{server}": "Shop ABC",
  "{member_count}": "1,234",
  "{prize}": "3-month Nitro",
  "{ends_at}": "14/05/2026 20:00",
  "{host}": "@Admin",
  "{winners_count}": "2",
  "{winners}": "@User1, @User2",
  "{reason}": "Violation of rules",
  "{warn_count}": "3",
  "{stars}": "⭐⭐⭐⭐⭐",
  "{content}": "Great product, fast delivery!",
  "{ticket_id}": "42",
  "{close_reason}": "Resolved",
  "{staff.mention}": "@ModTran",
  "{duration}": "10 min",
  "{mod}": "Mod Alex",
  "{invite_code}": "abc123",
  "{inviter}": "@Admin",
  "{time_label}": "All time",
  "{leaderboard_lines}": "🥇 **John Doe** — $500\n🥈 **Jane Smith** — $300\n🥉 **Alex Lee** — $150",
  "{updated_at}": "15:30 14/05/2026",
};

export function replaceVars(text: string): string {
  return text.replace(/\{[\w.]+\}/g, (m) => DUMMY[m] ?? m);
}

export function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── Helper: build form from defaults ────────────────────────────────────────

export function defaultForm(eventKey: string, lang: "vi" | "en" = "vi"): FormState {
  // Per-product keys (product_123) fall back to san_pham_detail defaults
  const defaultKey = eventKey.startsWith("product_") ? "san_pham_detail" : eventKey;
  const d = DEFAULTS[defaultKey]?.[lang] ?? DEFAULTS[defaultKey]?.["vi"];
  const ev = EMBED_EVENTS.find((e) => e.key === eventKey);
  return {
    name: lang === "en" ? (ev?.labelEn ?? ev?.label ?? eventKey) : (ev?.label ?? eventKey),
    event_type: eventKey,
    title: d.title,
    description: d.description,
    color: d.color,
    author: d.author,
    author_icon_url: d.author_icon_url,
    footer: d.footer,
    thumbnail_url: d.thumbnail_url,
    image_url: d.image_url,
    fields: d.fields.map((f) => ({ ...f })),
    enabled: d.enabled,
    response_mode: "embed",
    text_template: "",
    existingId: undefined,
  };
}

// ─── Discord Preview Component ───────────────────────────────────────────────

export function DiscordPreview({ form }: { form: FormState }) {
  const { t } = useT();
  const inlineFields = form.fields.filter((f) => f.inline);
  const blockFields = form.fields.filter((f) => !f.inline);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="rounded-lg bg-[#313338] p-4 font-sans text-sm">
      {/* Bot message header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-lg"
          style={{ backgroundColor: form.color || "#5865F2" }}
        >
          🤖
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#F2F3F5] text-sm">Dashboard Bot</span>
            <span className="bg-[#5865F2] text-white text-[10px] font-medium px-1 py-0.5 rounded leading-none">
              BOT
            </span>
            <span className="text-xs text-[#949BA4] ml-1">
              {t("embed_todayAt")} {timeStr}
            </span>
          </div>
        </div>
      </div>

      {/* Embed card */}
      <div className="flex gap-3 pl-[52px]">
        <div
          className="relative max-w-[520px] min-w-[200px] rounded bg-[#2B2D31] overflow-hidden"
          style={{ borderLeft: `4px solid ${form.color || "#5865F2"}` }}
        >
          {/* Inner grid: content | thumbnail */}
          <div className="flex">
            {/* Content side */}
            <div className="flex-1 p-4 space-y-2 min-w-0">
              {/* Author */}
              {(form.author || form.author_icon_url) && (
                <div className="flex items-center gap-2">
                  {form.author_icon_url && (
                    <img
                      src={form.author_icon_url}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  {form.author && (
                    <span className="text-xs font-medium text-[#B5BAC1]">
                      {replaceVars(form.author)}
                    </span>
                  )}
                </div>
              )}

              {/* Title */}
              {form.title && (
                <div className="font-semibold text-[#0A66C2] leading-snug">
                  {parseBold(replaceVars(form.title))}
                </div>
              )}

              {/* Description */}
              {form.description && (
                <div className="whitespace-pre-wrap text-[#B5BAC1] text-sm leading-relaxed">
                  {parseBold(replaceVars(form.description))}
                </div>
              )}

              {/* Block fields */}
              {blockFields.length > 0 && (
                <div className="space-y-1 pt-1">
                  {blockFields.map((f, i) => (
                    <div key={`b${i}`}>
                      <div className="font-semibold text-[#F2F3F5] text-sm">
                        {replaceVars(f.name)}
                      </div>
                      <div className="text-[#B5BAC1] text-sm">
                        {replaceVars(f.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline fields grid */}
              {inlineFields.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 pt-1">
                  {inlineFields.map((f, i) => (
                    <div key={`i${i}`} className="min-w-0">
                      <div className="font-semibold text-[#F2F3F5] text-sm truncate">
                        {replaceVars(f.name)}
                      </div>
                      <div className="text-[#B5BAC1] text-sm truncate">
                        {replaceVars(f.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Large image */}
              {form.image_url && (
                <div className="pt-1">
                  <img
                    src={form.image_url}
                    alt="Embed"
                    className="max-w-full rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              {/* Footer + timestamp */}
              {form.footer && (
                <div className="flex items-center gap-2 pt-1 text-xs text-[#B5BAC1]">
                  <span>{replaceVars(form.footer)}</span>
                  <span>•</span>
                  <span>{t("embed_todayAt")} {timeStr}</span>
                </div>
              )}
            </div>

            {/* Thumbnail */}
            {form.thumbnail_url && (
              <div className="shrink-0 p-4 pl-0 self-start">
                <img
                  src={form.thumbnail_url}
                  alt="Thumbnail"
                  className="w-20 h-20 rounded object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

