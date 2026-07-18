'use client';

import { useCallback, useEffect, useState } from 'react';

// Kept in sync with SUPPORTED_PROVIDERS in src/lib/ai/index.ts. Not imported directly
// because that module pulls in prisma/server-only code that shouldn't hit the client bundle.
const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'claude', label: 'Anthropic Claude' },
] as const;

interface ConfigRow {
  provider: string;
  preferredModel: string | null;
  isActive: boolean;
  maskedKey: string;
}

interface Draft {
  apiKey: string;
  preferredModel: string;
}

export default function AiConfigManager() {
  const [configs, setConfigs] = useState<ConfigRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/ai-config');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load AI configuration');
      setConfigs(data.configs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI configuration');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function configFor(provider: string) {
    return configs?.find((c) => c.provider === provider) ?? null;
  }

  function draftFor(provider: string): Draft {
    return drafts[provider] ?? { apiKey: '', preferredModel: '' };
  }

  function updateDraft(provider: string, field: keyof Draft, value: string) {
    setDrafts((prev) => ({ ...prev, [provider]: { ...draftFor(provider), [field]: value } }));
  }

  async function handleSave(provider: string, makeActive: boolean) {
    const draft = draftFor(provider);
    if (!draft.apiKey.trim()) {
      setError('Enter an API key first.');
      return;
    }
    setBusyProvider(provider);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: draft.apiKey.trim(),
          preferredModel: draft.preferredModel.trim() || undefined,
          isActive: makeActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save key');
      setDrafts((prev) => ({ ...prev, [provider]: { apiKey: '', preferredModel: '' } }));
      setNotice(`Saved your ${provider} key.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleSetActive(provider: string) {
    setBusyProvider(provider);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/ai-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, isActive: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to set active provider');
      setNotice(`${provider} is now your active provider.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active provider');
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleRemove(provider: string) {
    if (!confirm(`Remove your ${provider} API key?`)) return;
    setBusyProvider(provider);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/ai-config?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove key');
      setNotice(`Removed your ${provider} key.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove key');
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI provider keys</h1>
        <p className="mt-1 text-sm text-muted">
          Add your own API key for each provider you want to use, then pick one as
          &ldquo;active&rdquo; — that&apos;s the key used whenever you chat.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300">
          {notice}
        </div>
      )}
      {configs === null && !error && <p className="text-sm text-muted">Loading…</p>}

      <div className="flex flex-col gap-4">
        {PROVIDERS.map(({ id, label }) => {
          const config = configFor(id);
          const draft = draftFor(id);
          const isBusy = busyProvider === id;

          return (
            <div key={id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{label}</h2>
                  {config?.isActive && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      Active
                    </span>
                  )}
                </div>
                {config && <span className="font-mono text-sm text-muted">{config.maskedKey}</span>}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  placeholder={config ? 'Enter a new key to replace it' : 'API key'}
                  value={draft.apiKey}
                  onChange={(e) => updateDraft(id, 'apiKey', e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  autoComplete="off"
                />
                <input
                  type="text"
                  placeholder="Model (optional)"
                  value={draft.preferredModel}
                  onChange={(e) => updateDraft(id, 'preferredModel', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent sm:w-40"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(id, !config)}
                  disabled={isBusy}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  {isBusy ? 'Saving…' : config ? 'Update key' : 'Save key'}
                </button>
                {config && !config.isActive && (
                  <button
                    type="button"
                    onClick={() => handleSetActive(id)}
                    disabled={isBusy}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/10"
                  >
                    Make active
                  </button>
                )}
                {config && (
                  <button
                    type="button"
                    onClick={() => handleRemove(id)}
                    disabled={isBusy}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-red-400 hover:text-red-500 disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
