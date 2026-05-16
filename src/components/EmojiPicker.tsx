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

// ─── Unicode Emojis by Category ──────────────────────────────────────────────

const EMOJI_CATEGORIES: { label: string; emojis: [string, string][] }[] = [
  {
    label: "Hay dùng",
    emojis: [
      ["✅", "check"], ["❌", "x"], ["🎉", "tada"], ["⭐", "star"], ["🔥", "fire"],
      ["✨", "sparkles"], ["❤️", "heart"], ["💯", "100"], ["👍", "thumbsup"], ["👎", "thumbsdown"],
      ["👋", "wave"], ["🙌", "raised_hands"], ["👏", "clap"], ["🤝", "handshake"], ["💪", "muscle"],
      ["🎁", "gift"], ["🏆", "trophy"], ["🎮", "video_game"], ["🎵", "musical_note"], ["🔔", "bell"],
    ],
  },
  {
    label: "Emotions",
    emojis: [
      ["😀", "grinning"], ["😃", "smiley"], ["😄", "smile"], ["😁", "grin"], ["😆", "laughing"],
      ["😅", "sweat_smile"], ["🤣", "rofl"], ["😂", "joy"], ["🙂", "slightly_smiling"],
      ["😉", "wink"], ["😊", "blush"], ["😇", "innocent"], ["🥰", "smiling_hearts"],
      ["😍", "heart_eyes"], ["🤩", "star_struck"], ["😘", "kissing_heart"], ["😋", "yum"],
      ["🤔", "thinking"], ["🤨", "raised_eyebrow"], ["😐", "neutral"], ["😑", "expressionless"],
      ["😶", "no_mouth"], ["😏", "smirk"], ["😒", "unamused"], ["🙄", "rolling_eyes"],
      ["😬", "grimacing"], ["😮‍💨", "exhale"], ["🤥", "lying"], ["😌", "relieved"],
      ["😔", "pensive"], ["😪", "sleepy"], ["🤤", "drool"], ["😴", "sleeping"],
      ["😷", "mask"], ["🤒", "sick"], ["🤕", "hurt"], ["🤢", "nauseated"],
      ["🤮", "vomit"], ["🥵", "hot"], ["🥶", "cold"], ["🥴", "woozy"],
      ["😵", "dizzy"], ["🤯", "exploding_head"], ["😎", "sunglasses"], ["🥳", "partying"],
      ["😢", "cry"], ["😭", "sob"], ["😤", "triumph"], ["😡", "rage"],
      ["🤬", "cursing"], ["😈", "smiling_imp"], ["👿", "imp"], ["💀", "skull"],
      ["👻", "ghost"], ["🤡", "clown"], ["💩", "poop"], ["🥱", "yawning"],
    ],
  },
  {
    label: "Cử chỉ",
    emojis: [
      ["👋", "wave"], ["🤚", "raised_back"], ["🖐️", "hand_splayed"], ["✋", "hand"],
      ["🖖", "vulcan"], ["👌", "ok_hand"], ["🤌", "pinched"], ["✌️", "v"],
      ["🤞", "crossed_fingers"], ["🤟", "love_you"], ["🤘", "metal"], ["🤙", "call_me"],
      ["👈", "left"], ["👉", "right"], ["👆", "up"], ["👇", "down"],
      ["☝️", "index_up"], ["👍", "thumbsup"], ["👎", "thumbsdown"], ["✊", "fist"],
      ["👊", "punch"], ["🤛", "left_fist"], ["🤜", "right_fist"], ["👏", "clap"],
      ["🙌", "raised_hands"], ["🤝", "handshake"], ["🙏", "pray"], ["💪", "muscle"],
    ],
  },
  {
    label: "Vật thể",
    emojis: [
      ["🛒", "cart"], ["📦", "package"], ["💰", "moneybag"], ["💵", "dollar"],
      ["💎", "gem"], ["🎫", "ticket"], ["🏷️", "label"], ["📋", "clipboard"],
      ["📝", "memo"], ["📌", "pushpin"], ["📎", "paperclip"], ["🔗", "link"],
      ["🔒", "lock"], ["🔓", "unlock"], ["🔑", "key"], ["🛡️", "shield"],
      ["⚔️", "crossed_swords"], ["🔧", "wrench"], ["⚙️", "gear"], ["🔨", "hammer"],
      ["💡", "bulb"], ["📱", "phone"], ["💻", "computer"], ["🖥️", "desktop"],
      ["📷", "camera"], ["🎬", "clapper"], ["📺", "tv"], ["📻", "radio"],
    ],
  },
  {
    label: "Symbol",
    emojis: [
      ["❤️", "red_heart"], ["🧡", "orange_heart"], ["💛", "yellow_heart"], ["💚", "green_heart"],
      ["💙", "blue_heart"], ["💜", "purple_heart"], ["🖤", "black_heart"], ["🤍", "white_heart"],
      ["💔", "broken_heart"], ["❣️", "heart_excl"], ["💕", "two_hearts"], ["💞", "revolving_hearts"],
      ["⚡", "zap"], ["🔊", "loud_sound"], ["🔇", "mute"], ["📢", "loudspeaker"],
      ["📣", "mega"], ["🔴", "red_circle"], ["🟠", "orange_circle"], ["🟡", "yellow_circle"],
      ["🟢", "green_circle"], ["🔵", "blue_circle"], ["🟣", "purple_circle"], ["⚫", "black_circle"],
      ["⚪", "white_circle"], ["🟥", "red_square"], ["🟧", "orange_square"], ["🟨", "yellow_square"],
      ["🟩", "green_square"], ["🟦", "blue_square"], ["🟪", "purple_square"], ["⬛", "black_square"],
      ["⬜", "white_square"], ["▶️", "play"], ["⏸️", "pause"], ["⏹️", "stop"],
      ["⏭️", "next"], ["⏮️", "prev"], ["🔁", "repeat"], ["🔂", "repeat_one"],
      ["➕", "plus"], ["➖", "minus"], ["✖️", "multiply"], ["➗", "divide"],
      ["❓", "question"], ["❗", "exclamation"], ["‼️", "bangbang"], ["⁉️", "interrobang"],
      ["💤", "zzz"], ["♾️", "infinity"], ["🔄", "arrows_counterclockwise"],
    ],
  },
  {
    label: "Động vật & Thiên nhiên",
    emojis: [
      ["🐶", "dog"], ["🐱", "cat"], ["🐭", "mouse"], ["🐰", "rabbit"],
      ["🦊", "fox"], ["🐻", "bear"], ["🐼", "panda"], ["🐨", "koala"],
      ["🦁", "lion"], ["🐯", "tiger"], ["🐮", "cow"], ["🐷", "pig"],
      ["🐸", "frog"], ["🐵", "monkey"], ["🐔", "chicken"], ["🐧", "penguin"],
      ["🐦", "bird"], ["🦅", "eagle"], ["🦋", "butterfly"], ["🐛", "bug"],
      ["🌸", "cherry_blossom"], ["🌹", "rose"], ["🌻", "sunflower"], ["🍀", "four_leaf"],
      ["🌲", "evergreen"], ["🌴", "palm"], ["🌈", "rainbow"], ["☀️", "sun"],
      ["🌙", "moon"], ["⭐", "star2"], ["🌊", "ocean"], ["💧", "droplet"],
    ],
  },
  {
    label: "Đồ ăn",
    emojis: [
      ["🍎", "apple"], ["🍊", "orange"], ["🍋", "lemon"], ["🍌", "banana"],
      ["🍉", "watermelon"], ["🍇", "grapes"], ["🍓", "strawberry"], ["🍑", "peach"],
      ["🍕", "pizza"], ["🍔", "burger"], ["🍟", "fries"], ["🌭", "hotdog"],
      ["🍩", "donut"], ["🍰", "cake"], ["🍫", "chocolate"], ["🍿", "popcorn"],
      ["☕", "coffee"], ["🍵", "tea"], ["🧃", "juice_box"], ["🍺", "beer"],
    ],
  },
  {
    label: "Cờ & Số",
    emojis: [
      ["🏁", "checkered_flag"], ["🚩", "red_flag"], ["🏴", "black_flag"], ["🏳️", "white_flag"],
      ["0️⃣", "zero"], ["1️⃣", "one"], ["2️⃣", "two"], ["3️⃣", "three"],
      ["4️⃣", "four"], ["5️⃣", "five"], ["6️⃣", "six"], ["7️⃣", "seven"],
      ["8️⃣", "eight"], ["9️⃣", "nine"], ["🔟", "ten"], ["#️⃣", "hash"],
      ["*️⃣", "asterisk"], ["🔢", "numbers"], ["🔤", "abc"], ["🆎", "ab"],
      ["🆑", "cl"], ["🆒", "cool"], ["🆓", "free"], ["🆔", "id"],
      ["🆕", "new"], ["🆗", "ok"], ["🆘", "sos"], ["🆙", "up"],
      ["🔠", "capital_abcd"], ["🔡", "abcd"], ["🔣", "symbols"],
    ],
  },
];

// Flatten for search
const ALL_UNICODE: [string, string][] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

// ─── Component ───────────────────────────────────────────────────────────────

export function EmojiPicker({ onSelect, children }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"custom" | "unicode">("custom");

  const { data: emojis = [] } = useQuery<DiscordEmoji[]>({
    queryKey: ["managed-emojis"],
    queryFn: () =>
      fetch("/api/managed-emojis", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load emojis");
        return r.json();
      }),
    staleTime: 30_000,
  });

  const filtered = emojis.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const searchLower = search.toLowerCase();
  const filteredUnicode = search
    ? ALL_UNICODE.filter(([, name]) => name.includes(searchLower))
    : null; // null = show by category

  function handleSelect(emoji: string) {
    onSelect(emoji);
    setOpen(false);
    setSearch("");
  }

  function formatCustomEmoji(e: DiscordEmoji): string {
    return e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
  }

  function renderEmojiGrid(list: [string, string][]) {
    return (
      <div className="grid grid-cols-8 gap-0.5 px-2">
        {list.map(([emoji, name], i) => (
          <TooltipProvider key={`${name}-${i}`} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded p-1 hover:bg-accent transition-colors text-lg leading-none"
                  onClick={() => handleSelect(emoji)}
                >
                  {emoji}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                :{name}:
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center shrink-0",
              "h-8 w-8 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/50",
              "transition-colors"
            )}
          >
            <Smile className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="bottom">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              tab === "custom"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("custom")}
          >
            Custom
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              tab === "unicode"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("unicode")}
          >
            Unicode
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
        <ScrollArea className="h-64">
          {tab === "custom" ? (
            filtered.length > 0 ? (
              <div className="grid grid-cols-8 gap-0.5 px-2 pb-2">
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
                        :{e.name}:
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
              </div>
            ) : (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-muted-foreground">
                  {search ? "Không tìm thấy emoji" : "No custom emojis yet"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Thêm emoji tại Quản lý Emoji
                </p>
              </div>
            )
          ) : filteredUnicode ? (
            // Search results
            filteredUnicode.length > 0 ? (
              <div className="pb-2">
                {renderEmojiGrid(filteredUnicode)}
              </div>
            ) : (
              <p className="px-3 py-8 text-xs text-muted-foreground text-center">
                Không tìm thấy emoji
              </p>
            )
          ) : (
            // Browse by category
            <div className="pb-2 space-y-2">
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <p className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover">
                    {cat.label}
                  </p>
                  {renderEmojiGrid(cat.emojis)}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
