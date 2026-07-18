'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export default function ChatShell({ activeConversationId }: { activeConversationId: string | null }) {
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setConversations(data.conversations ?? []);
    } catch {
      // Sidebar list is non-critical; fail silently and let the user retry via navigation.
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setConversationError(null);
      setNeedsKey(false);
      return;
    }

    let cancelled = false;
    setConversationLoading(true);
    setConversationError(null);
    setNeedsKey(false);

    fetch(`/api/conversations/${activeConversationId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setConversationError(data.error === 'Conversation not found' ? 'Conversation not found.' : 'Failed to load conversation.');
          setMessages([]);
          return;
        }
        setMessages(data.conversation.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) setConversationError('Failed to load conversation.');
      })
      .finally(() => {
        if (!cancelled) setConversationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleNewConversation() {
    setCreating(true);
    try {
      const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadConversations();
        setSidebarOpen(false);
        router.push(`/app/chat/${data.conversation.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadConversations();
      if (id === activeConversationId) router.push('/app/chat');
    }
  }

  async function sendToConversation(conversationId: string, content: string) {
    setSending(true);
    setNeedsKey(false);
    setConversationError(null);
    const optimisticUserMessage: Message = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === 'NO_ACTIVE_KEY') {
          setNeedsKey(true);
          // Keep the user's message (it was saved server-side) but drop the optimistic dupe.
          setMessages((prev) => {
            const withoutOptimistic = prev.filter((m) => m.id !== optimisticUserMessage.id);
            return data.userMessage ? [...withoutOptimistic, data.userMessage] : withoutOptimistic;
          });
        } else {
          setConversationError(data.message || 'Failed to get a reply. Please try again.');
        }
        return;
      }

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticUserMessage.id);
        return [...withoutOptimistic, data.userMessage, data.assistantMessage];
      });
      await loadConversations();
    } catch {
      setConversationError('Failed to get a reply. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending || creating) return;
    setInput('');

    if (!activeConversationId) {
      // No conversation yet: create one, navigate to it, then send the first message.
      setCreating(true);
      try {
        const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setInput(content);
          return;
        }
        await loadConversations();
        router.push(`/app/chat/${data.conversation.id}`);
        await sendToConversation(data.conversation.id, content);
      } finally {
        setCreating(false);
      }
      return;
    }

    await sendToConversation(activeConversationId, content);
  }

  return (
    <div className="relative flex flex-1 min-h-0">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:w-72 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <span className="text-sm font-semibold">Conversations</span>
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={creating}
            className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations === null && <p className="px-2 py-1 text-sm text-muted">Loading…</p>}
          {conversations?.length === 0 && <p className="px-2 py-1 text-sm text-muted">No conversations yet.</p>}
          <ul className="flex flex-col gap-1">
            {conversations?.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <Link
                  href={`/app/chat/${c.id}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-sm transition-colors ${
                    c.id === activeConversationId
                      ? 'bg-accent/15 font-medium text-accent'
                      : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {c.title || 'New chat'}
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  aria-label="Delete conversation"
                  className="shrink-0 rounded-lg px-1.5 py-1 text-xs text-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border p-2 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversations"
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm"
          >
            ☰
          </button>
          <span className="truncate text-sm font-medium">
            {conversations?.find((c) => c.id === activeConversationId)?.title || 'Chat'}
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            {!activeConversationId && messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Start a new conversation or pick one from the sidebar.
              </div>
            )}
            {conversationLoading && <p className="text-center text-sm text-muted">Loading conversation…</p>}
            {conversationError && <p className="text-sm text-red-500">{conversationError}</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed sm:max-w-[75%] ${
                    m.role === 'user'
                      ? 'bg-accent text-accent-foreground'
                      : 'border border-border bg-surface text-foreground'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-muted">
                  Thinking…
                </div>
              </div>
            )}
            {needsKey && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                You don&apos;t have an AI key configured yet.{' '}
                <Link href="/app/settings" className="font-medium underline">
                  Add one in Settings
                </Link>{' '}
                to keep chatting.
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-3 sm:px-6">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as unknown as FormEvent);
              }
            }}
            rows={1}
            placeholder="Message the assistant…"
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={sending || creating || !input.trim()}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
