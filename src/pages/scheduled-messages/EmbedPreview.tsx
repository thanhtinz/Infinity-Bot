import { cn } from "@/lib/utils";

import type { EmbedData } from "./smTypes";
import { DEFAULT_COLOR } from "./smConstants";

interface DiscordEmbedPreviewProps {
  data: EmbedData;
}

export function DiscordEmbedPreview({ data }: DiscordEmbedPreviewProps) {
  const colorHex = data.color || DEFAULT_COLOR;
  const hasContent = data.title || data.description || data.fields.length > 0 || data.footer || data.author_name;

  if (!hasContent) {
    return (
      <div className="rounded-md bg-[#313338] p-6 text-center">
        <p className="text-sm text-[#B5BAC1]">Embed preview will appear here</p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-[#313338] p-4 flex gap-3">
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: colorHex }}
      />
      <div className="flex-1 min-w-0">
        {data.author_name && (
          <div className="flex items-center gap-2 mb-1">
            {data.author_icon_url && (
              <img
                src={data.author_icon_url}
                alt=""
                className="w-5 h-5 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <p className="text-[11px] font-medium text-[#B5BAC1]">{data.author_name}</p>
          </div>
        )}
        {data.title && (
          <p className="font-semibold text-[#F2F3F5] text-sm">{data.title}</p>
        )}
        {data.description && (
          <p className="text-[#B5BAC1] text-xs whitespace-pre-wrap mt-1">
            {data.description}
          </p>
        )}
        {data.fields.length > 0 && (
          <div className="grid gap-1 mt-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            {data.fields.map((f, i) => (
              <div key={i} className={cn(!f.inline && "col-span-full")}>
                <p className="font-semibold text-[#F2F3F5] text-xs">{f.name}</p>
                <p className="text-[#B5BAC1] text-xs whitespace-pre-wrap">{f.value}</p>
              </div>
            ))}
          </div>
        )}
        {data.image_url && (
          <div className="pt-1">
            <img
              src={data.image_url}
              alt=""
              className="rounded max-h-48 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        {data.footer && (
          <p className="text-[#B5BAC1] text-[11px] pt-1">{data.footer}</p>
        )}
      </div>
      {data.thumbnail_url && (
        <img
          src={data.thumbnail_url}
          alt=""
          className="w-16 h-16 rounded object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}
