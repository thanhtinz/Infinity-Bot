import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiscordRoles } from "@/hooks/useDiscordData";
import { useT } from "@/i18n";

interface RoleSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  guildId?: string;
  disabled?: boolean;
}

function intToHex(color: number): string {
  if (!color) return "hsl(var(--muted-foreground))";
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function RoleSelect({ value, onChange, placeholder = "Select role...", guildId, disabled }: RoleSelectProps) {
  const { data: roles = [], isLoading } = useDiscordRoles(guildId);
  const { t } = useT();

  const sorted = useMemo(() => [...roles].sort((a, b) => a.name.localeCompare(b.name)), [roles]);

  if (!sorted.length && !isLoading) {
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
        {sorted.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: intToHex(r.color) }}
              />
              {r.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface MultiRoleSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  guildId?: string;
  disabled?: boolean;
}

export function MultiRoleSelect({ value, onChange, placeholder = "Select roles...", guildId, disabled }: MultiRoleSelectProps) {
  const { data: roles = [], isLoading } = useDiscordRoles(guildId);
  const { t } = useT();
  const sorted = useMemo(() => [...roles].sort((a, b) => a.name.localeCompare(b.name)), [roles]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  if (!sorted.length && !isLoading) {
    return (
      <Input
        placeholder={placeholder}
        value={value.join(", ")}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        disabled={disabled}
      />
    );
  }

  const addRole = (id: string) => {
    if (!value.includes(id)) onChange([...value, id]);
  };

  const removeRole = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  const available = sorted.filter((r) => !value.includes(r.id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const role = roleMap.get(id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="cursor-pointer gap-1 pr-1"
                onClick={() => removeRole(id)}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: role ? intToHex(role.color) : undefined }}
                />
                {role?.name || id}
                <span className="ml-0.5 text-muted-foreground hover:text-foreground">×</span>
              </Badge>
            );
          })}
        </div>
      )}
      <Select value="" onValueChange={addRole} disabled={disabled || !available.length}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? t("loading") : available.length ? placeholder : "All selected"} />
        </SelectTrigger>
        <SelectContent>
          {available.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: intToHex(r.color) }}
                />
                {r.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
