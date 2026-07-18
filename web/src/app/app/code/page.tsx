'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProjectSummary {
  id: string;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_LANGUAGES = ['python', 'javascript', 'typescript', 'c++', 'java', 'go', 'rust'];

export default function CodeProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>(DEFAULT_LANGUAGES);
  const [newName, setNewName] = useState('');
  const [newLanguage, setNewLanguage] = useState('python');
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/code-projects');
    if (!res.ok) {
      setError('Failed to load projects.');
      return;
    }
    const data = await res.json();
    setProjects(data.projects);
  }, []);

  useEffect(() => {
    loadProjects();
    fetch('/api/runtimes')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.runtimes) return;
        const unique = Array.from(new Set(data.runtimes.map((r: { language: string }) => r.language))) as string[];
        if (unique.length) setLanguages(unique.sort());
      })
      .catch(() => {});
  }, [loadProjects]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/code-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || 'Untitled project', language: newLanguage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to create project.');
        return;
      }
      const data = await res.json();
      router.push(`/app/code/${data.project.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const res = await fetch(`/api/code-projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProjects((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } else {
      setError('Failed to delete project.');
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Code projects</h1>
        <Link href="/app" className="text-sm text-muted hover:text-foreground">
          Back
        </Link>
      </div>

      <form
        onSubmit={createProject}
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-muted" htmlFor="new-project-name">
            Project name
          </label>
          <input
            id="new-project-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Untitled project"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted" htmlFor="new-project-language">
            Language
          </label>
          <select
            id="new-project-language"
            value={newLanguage}
            onChange={(e) => setNewLanguage(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'New project'}
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {projects === null ? (
        <p className="text-sm text-muted">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted">No projects yet. Create one above to get started.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <Link href={`/app/code/${project.id}`} className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{project.name}</span>
                <span className="text-xs text-muted">
                  {project.language} · updated {new Date(project.updatedAt).toLocaleString()}
                </span>
              </Link>
              <button
                onClick={() => deleteProject(project.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-400 hover:text-red-500"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
