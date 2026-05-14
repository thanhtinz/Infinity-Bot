import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiscordChannels } from "@/hooks/useDiscordData";
import type { DiscordChannel } from "@/hooks/useDiscordData";
import { Hash, Volume2, FolderOpen, Megaphone, MessageSquare } from "lucide-react";

const CHANNEL_ICONS: Record<number, typeof Hash> = {
  0: Hash,
  2: Volume2,
  4: FolderOpen,
  5: Megaphone,
  15: MessageSquare,
};

interface ChannelSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filter?: "text" | "voice" | "category" | "all";
  guildId?: string;
  disabled?: boolean;
}

function filterChannels(channels: DiscordChannel[], filter: string): DiscordChannel[] {
  switch (filter) {
    case "text":
      return channels.filter((c) => c.type === 0 || c.type === 5 || c.type === 15);
    case "voice":
      return channels.filter((c) => c.type === 2 || c.type === 13);
    case "category":
      return channels.filter((c) => c.type === 4);
    default:
      return channels;
  }
}

function groupByCategory(
  channels: DiscordChannel[],
  allChannels: DiscordChannel[]
): { category: DiscordChannel | null; channels: DiscordChannel[] }[] {
  const categories = allChannels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const catMap = new Map<string, DiscordChannel>();
  categories.forEach((c) => catMap.set(c.id, c));

  const grouped = new Map<string | null, DiscordChannel[]>();

  for (const ch of channels) {
    if (ch.type === 4) continue; // skip categories themselves
    const key = ch.parent_id || null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ch);
  }

  const result: { category: DiscordChannel | null; channels: DiscordChannel[] }[] = [];

  // Uncategorized first
  const uncategorized = grouped.get(null);
  if (uncategorized?.length) {
    result.push({ category: null, channels: uncategorized.sort((a, b) => a.position - b.position) });
  }

  // Then by category order
  for (const cat of categories) {
    const children = grouped.get(cat.id);
    if (children?.length) {
      result.push({ category: cat, channels: children.sort((a, b) => a.position - b.position) });
    }
  }

  return result;
}

export function ChannelSelect({ value, onChange, placeholder = "Chọn kênh...", filter = "text", guildId, disabled }: ChannelSelectProps) {
  const { data: allChannels = [], isLoading } = useDiscordChannels(guildId);

  const filtered = useMemo(() => filterChannels(allChannels, filter), [allChannels, filter]);

  // For category filter, no grouping needed
  if (filter === "category") {
    const categories = filtered.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
    if (!categories.length && !isLoading) {
      return (
        <Input
          placeholder={isLoading ? "Đang tải..." : placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
    }
    return (
      <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Đang tải..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const groups = useMemo(() => groupByCategory(filtered, allChannels), [filtered, allChannels]);

  if (!groups.length && !isLoading) {
    return (
      <Input
        placeholder={isLoading ? "Đang tải..." : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    );
  }

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Đang tải..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectGroup key={group.category?.id ?? "none"}>
            {group.category && (
              <SelectLabel className="text-xs uppercase text-muted-foreground">
                {group.category.name}
              </SelectLabel>
            )}
            {group.channels.map((ch) => {
              const Icon = CHANNEL_ICONS[ch.type] || Hash;
              return (
                <SelectItem key={ch.id} value={ch.id}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {ch.name}
                  </span>
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
