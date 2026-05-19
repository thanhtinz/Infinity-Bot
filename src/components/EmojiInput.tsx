/**
 * EmojiInput / EmojiTextarea
 *
 * Drop-in wrappers around shadcn Input / Textarea that add an emoji picker
 * button. The emoji is inserted at the current cursor position (or appended
 * when there is no selection). Both components forward all standard props.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";

// ── helpers ──────────────────────────────────────────────────────────────────

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  emoji: string,
  onChange: (next: string) => void
) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + emoji + el.value.slice(end);
  onChange(next);
  // Restore focus + cursor after React re-render
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + emoji.length;
    el.setSelectionRange(pos, pos);
  });
}

// ── EmojiInput ────────────────────────────────────────────────────────────────

type InputProps = React.ComponentProps<"input">;

export interface EmojiInputProps extends Omit<InputProps, "onChange"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Extra class on the outer wrapper div */
  wrapperClassName?: string;
}

export const EmojiInput = React.forwardRef<HTMLInputElement, EmojiInputProps>(
  ({ className, wrapperClassName, value = "", onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLInputElement>) ?? innerRef;

    function handleSelect(emoji: string) {
      const el = resolvedRef.current;
      if (!el) return;
      insertAtCursor(el, emoji, (next) => {
        // Synthesise a ChangeEvent so callers don't need special handling
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(el, next);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        if (onChange) {
          const syntheticEvent = {
            target: el,
            currentTarget: el,
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
      });
    }

    return (
      <div
        className={cn(
          "flex w-full items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring",
          wrapperClassName
        )}
      >
        <input
          ref={resolvedRef}
          value={value}
          onChange={onChange}
          className={cn(
            "flex h-9 w-full rounded-md bg-transparent px-3 py-1 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1",
            className
          )}
          {...props}
        />
        <EmojiPicker onSelect={handleSelect} />
      </div>
    );
  }
);
EmojiInput.displayName = "EmojiInput";

// ── EmojiTextarea ─────────────────────────────────────────────────────────────

type TextareaProps = React.ComponentProps<"textarea">;

export interface EmojiTextareaProps extends Omit<TextareaProps, "onChange"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Extra class on the outer wrapper div */
  wrapperClassName?: string;
}

export const EmojiTextarea = React.forwardRef<HTMLTextAreaElement, EmojiTextareaProps>(
  ({ className, wrapperClassName, value = "", onChange, rows = 3, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? innerRef;

    function handleSelect(emoji: string) {
      const el = resolvedRef.current;
      if (!el) return;
      insertAtCursor(el, emoji, (next) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(el, next);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        if (onChange) {
          const syntheticEvent = {
            target: el,
            currentTarget: el,
          } as React.ChangeEvent<HTMLTextAreaElement>;
          onChange(syntheticEvent);
        }
      });
    }

    return (
      <div
        className={cn(
          "flex w-full items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring",
          wrapperClassName
        )}
      >
        <textarea
          ref={resolvedRef}
          value={value}
          onChange={onChange}
          rows={rows}
          className={cn(
            "flex min-h-[60px] w-full rounded-md bg-transparent px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 resize-y",
            className
          )}
          {...props}
        />
        <EmojiPicker onSelect={handleSelect} />
      </div>
    );
  }
);
EmojiTextarea.displayName = "EmojiTextarea";
