import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useT } from "@/i18n";

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

export function ChannelSelect({ value, onChange, placeholder = "Select channel...", filter = "text", guildId, disabled }: ChannelSelectProps) {
  const { data: allChannels = [], isLoading } = useDiscordChannels(guildId);
  const { t } = useT();

  const filtered = useMemo(() => filterChannels(allChannels, filter), [allChannels, filter]);

  // For category filter, no grouping needed
  if (filter === "category") {
    const categories = filtered.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
    if (!categories.length && !isLoading) {
      return (
        <Input
          placeholder={isLoading ? t("loading") : placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
    }
    return (
      <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? t("loading") : placeholder} />
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
        placeholder={isLoading ? t("loading") : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    );
  }

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? t("loading") : placeholder} />
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

interface MultiChannelSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  filter?: "text" | "voice" | "category" | "all";
  guildId?: string;
  disabled?: boolean;
}

export function MultiChannelSelect({ value, onChange, placeholder = "Select channel...", filter = "text", guildId, disabled }: MultiChannelSelectProps) {
  const { data: allChannels = [], isLoading } = useDiscordChannels(guildId);
  const { t } = useT();
  const filtered = useMemo(() => filterChannels(allChannels, filter), [allChannels, filter]);
  const channelMap = useMemo(() => new Map(allChannels.map((c) => [c.id, c])), [allChannels]);
  const groups = useMemo(() => groupByCategory(filtered.filter((c) => !value.includes(c.id)), allChannels), [filtered, allChannels, value]);

  if (!filtered.length && !isLoading) {
    return (
      <Input
        placeholder={placeholder}
        value={value.join(", ")}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        disabled={disabled}
      />
    );
  }

  const addChannel = (id: string) => {
    if (!value.includes(id)) onChange([...value, id]);
  };
  const removeChannel = (id: string) => onChange(value.filter((v) => v !== id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const ch = channelMap.get(id);
            const Icon = ch ? CHANNEL_ICONS[ch.type] || Hash : Hash;
            return (
              <Badge key={id} variant="secondary" className="cursor-pointer gap-1 pr-1" onClick={() => removeChannel(id)}>
                <Icon className="h-3 w-3 text-muted-foreground" />
                {ch?.name || id}
                <span className="ml-0.5 text-muted-foreground hover:text-foreground">×</span>
              </Badge>
            );
          })}
        </div>
      )}
      <Select value="" onValueChange={addChannel} disabled={disabled || !groups.some((g) => g.channels.length)}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? t("loading") : groups.some((g) => g.channels.length) ? placeholder : "All selected"} />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.category?.id ?? "none"}>
              {group.category && <SelectLabel className="text-xs uppercase text-muted-foreground">{group.category.name}</SelectLabel>}
              {group.channels.map((ch) => {
                const Icon = CHANNEL_ICONS[ch.type] || Hash;
                return (
                  <SelectItem key={ch.id} value={ch.id}>
                    <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{ch.name}</span>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
