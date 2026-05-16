import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Variable, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { VARIABLE_GROUPS } from "./ccConstants";

export function VariablesReference() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const copyVar = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Variable className="h-3.5 w-3.5" />
          Biến số
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <Variable className="h-3 w-3" />
              Xem tất cả
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <ScrollArea className="h-80">
              <div className="p-3 space-y-3">
                {VARIABLE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.vars.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          className="w-full text-left flex items-center justify-between rounded px-2 py-1 hover:bg-accent transition-colors group"
                          onClick={() => copyVar(v.key)}
                        >
                          <span className="flex items-center gap-2">
                            <code className="text-xs font-mono text-primary">
                              {v.key}
                            </code>
                            <span className="text-[11px] text-muted-foreground">
                              {v.desc}
                            </span>
                          </span>
                          {copiedKey === v.key ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Sử dụng biến như <code className="text-primary">{"{user}"}</code>, <code className="text-primary">{"{server}"}</code> trong nội dung để hiển thị thông tin động.
      </p>
      {/* Quick inline expandable groups */}
      <div className="space-y-1">
        {VARIABLE_GROUPS.map((group) => (
          <div key={group.label}>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => toggleGroup(group.label)}
            >
              {expandedGroups.has(group.label) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {group.label}
            </button>
            {expandedGroups.has(group.label) && (
              <div className="pl-5 pt-1 pb-1 flex flex-wrap gap-1">
                {group.vars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono hover:bg-accent transition-colors"
                    onClick={() => copyVar(v.key)}
                    title={v.desc}
                  >
                    {v.key}
                    {copiedKey === v.key && (
                      <Check className="h-2.5 w-2.5 text-green-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
