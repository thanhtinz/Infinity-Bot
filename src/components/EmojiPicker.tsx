import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiscordEmoji {
  id: number;
  name: string;
  animated: boolean;
  url: string;
  usage: string;
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  children?: React.ReactNode;
}

// ─── Common Unicode Emojis ───────────────────────────────────────────────────

const UNICODE_EMOJIS = [
  "✅", "❌", "🎉", "🎫", "⭐", "🛒", "📦", "💰", "👋", "🔊",
  "🎭", "📋", "🛡️", "⚡", "🔔", "📢", "✨", "🎁", "🏆", "📊",
  "🔧", "⚙️", "📝", "💎", "🔥", "🎮", "🎵", "📌", "🔒", "🔴",
];

// ─── Component ───────────────────────────────────────────────────────────────

export function EmojiPicker({ onSelect, children }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"custom" | "unicode">("custom");

  const { data: emojis = [] } = useQuery<DiscordEmoji[]>({
    queryKey: ["discord-emojis"],
    queryFn: () =>
      fetch("/api/discord/emojis", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load emojis");
        return r.json();
      }),
    staleTime: 30_000,
  });

  const filtered = emojis.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUnicode = UNICODE_EMOJIS.filter(() =>
    search === "" || true // show all unicode emojis when on that tab
  );

  function handleSelect(emoji: string) {
    onSelect(emoji);
    setOpen(false);
    setSearch("");
  }

  function formatCustomEmoji(e: DiscordEmoji): string {
    return e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-md border border-input bg-background",
              "h-9 w-9 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              "transition-colors"
            )}
          >
            <Smile className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" side="bottom">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              tab === "custom"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("custom")}
          >
            Server Emoji
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              tab === "unicode"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("unicode")}
          >
            Cơ bản
          </button>
        </div>

        {/* Search */}
        <div className="p-2">
          <Input
            placeholder="Tìm emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Emoji Grid */}
        <ScrollArea className="h-56">
          {tab === "custom" ? (
            filtered.length > 0 ? (
              <div className="grid grid-cols-7 gap-1 px-2 pb-2">
                <TooltipProvider delayDuration={200}>
                  {filtered.map((e) => (
                    <Tooltip key={e.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded p-1 hover:bg-accent transition-colors"
                          onClick={() => handleSelect(formatCustomEmoji(e))}
                        >
                          <img
                            src={e.url}
                            alt={e.name}
                            className="h-6 w-6 object-contain"
                            loading="lazy"
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {e.name}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
              </div>
            ) : (
              <p className="px-3 pb-3 text-xs text-muted-foreground text-center">
                Không có emoji
              </p>
            )
          ) : (
            <div className="grid grid-cols-7 gap-1 px-2 pb-2">
              {filteredUnicode.map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  className="inline-flex items-center justify-center rounded p-1 hover:bg-accent transition-colors text-lg"
                  onClick={() => handleSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
