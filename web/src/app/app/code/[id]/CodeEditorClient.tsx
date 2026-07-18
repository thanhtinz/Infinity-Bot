'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Editor, { loader } from '@monaco-editor/react';

// Serve Monaco's AMD bundle from our own /public/monaco instead of the default
// jsdelivr CDN - this app is meant to be self-hosted, and pulling editor assets
// from a third-party CDN at runtime is an unnecessary external dependency/outage risk.
if (typeof window !== 'undefined') {
  loader.config({ paths: { vs: '/monaco/vs' } });
}

interface Project {
  id: string;
  name: string;
  language: string;
  code: string;
  stdin: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Runtime {
  language: string;
  version: string;
  aliases: string[];
}

interface RunOutput {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
}

interface RunResult {
  language: string;
  version: string;
  run: RunOutput;
  compile?: RunOutput;
}

type Skill = 'explain' | 'debug' | 'optimize' | 'convert' | 'generate-tests' | 'add-comments';

const SKILLS: { id: Skill; label: string }[] = [
  { id: 'explain', label: 'Explain' },
  { id: 'debug', label: 'Debug' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'convert', label: 'Convert language' },
  { id: 'generate-tests', label: 'Generate tests' },
  { id: 'add-comments', label: 'Add comments' },
];

// Maps a Piston runtime language id to the closest Monaco editor language id for syntax highlighting.
function monacoLanguageFor(lang: string): string {
  const map: Record<string, string> = {
    'c++': 'cpp',
    cpp: 'cpp',
    'c#': 'csharp',
    csharp: 'csharp',
    node: 'javascript',
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    python3: 'python',
    java: 'java',
    go: 'go',
    rust: 'rust',
    ruby: 'ruby',
    php: 'php',
    kotlin: 'kotlin',
    swift: 'swift',
    bash: 'shell',
    shell: 'shell',
    sql: 'sql',
    c: 'c',
  };
  return map[lang.toLowerCase()] ?? 'plaintext';
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type MobileView = 'editor' | 'panel';
type PanelTab = 'output' | 'skills';

export default function CodeEditorClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('');
  const [code, setCode] = useState('');
  const [stdin, setStdin] = useState('');

  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [version, setVersion] = useState('');

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [skill, setSkill] = useState<Skill>('explain');
  const [targetLanguage, setTargetLanguage] = useState('javascript');
  const [skillRunning, setSkillRunning] = useState(false);
  const [skillResult, setSkillResult] = useState<string | null>(null);
  const [skillError, setSkillError] = useState<string | null>(null);

  const [mobileView, setMobileView] = useState<MobileView>('editor');
  const [panelTab, setPanelTab] = useState<PanelTab>('output');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Initial load: project + available runtimes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/code-projects/${projectId}`);
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.status === 404 ? 'Project not found.' : 'Failed to load project.');
        return;
      }
      const data = await res.json();
      const p: Project = data.project;
      setProject(p);
      setName(p.name);
      setLanguage(p.language);
      setCode(p.code);
      setStdin(p.stdin ?? '');
    })();
    fetch('/api/runtimes')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.runtimes) setRuntimes(data.runtimes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const languages = useMemo(
    () => Array.from(new Set(runtimes.map((r) => r.language))).sort(),
    [runtimes]
  );
  const versionsForLanguage = useMemo(
    () => runtimes.filter((r) => r.language === language).map((r) => r.version),
    [runtimes, language]
  );

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirtyRef.current) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/code-projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, language, code, stdin }),
      });
      if (!res.ok) {
        setSaveStatus('error');
        return;
      }
      dirtyRef.current = false;
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [projectId, name, language, code, stdin]);

  // Debounced autosave whenever editable fields change (after initial load).
  useEffect(() => {
    if (!project) return;
    dirtyRef.current = true;
    setSaveStatus('idle');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNow();
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, language, code, stdin]);

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    setMobileView('panel');
    setPanelTab('output');
    try {
      await saveNow();
      const res = await fetch(`/api/code-projects/${projectId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(version ? { version } : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRunError(data?.error || 'Execution failed.');
        return;
      }
      setRunResult(data.result);
    } catch {
      setRunError('Execution failed.');
    } finally {
      setRunning(false);
    }
  }

  async function handleRunSkill() {
    setSkillRunning(true);
    setSkillError(null);
    setSkillResult(null);
    setMobileView('panel');
    setPanelTab('skills');
    try {
      await saveNow();
      const res = await fetch(`/api/code-projects/${projectId}/skill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill, targetLanguage: skill === 'convert' ? targetLanguage : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSkillError(data?.error || 'AI request failed.');
        return;
      }
      setSkillResult(data.text);
    } catch {
      setSkillError('AI request failed.');
    } finally {
      setSkillRunning(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <p className="text-sm text-red-500">{loadError}</p>
        <Link href="/app/code" className="text-sm text-accent hover:text-accent-hover">
          Back to projects
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-sm text-muted">Loading project…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 sm:px-4">
        <Link href="/app/code" className="shrink-0 text-sm text-muted hover:text-foreground">
          ← Projects
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none hover:border-border focus:border-accent"
        />
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setVersion('');
          }}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          {!languages.includes(language) && <option value={language}>{language}</option>}
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <select
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">latest</option>
          {versionsForLanguage.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && <span className="text-red-500">Save failed</span>}
        </span>
        <button
          onClick={saveNow}
          className="rounded-md border border-border px-3 py-1 text-xs hover:border-accent"
        >
          Save
        </button>
        <button
          onClick={handleRun}
          disabled={running}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
        >
          {running ? 'Running…' : 'Run ▶'}
        </button>
      </div>

      {/* Mobile tab bar */}
      <div className="flex border-b border-border md:hidden">
        {(['editor', 'output', 'skills'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              if (tab === 'editor') setMobileView('editor');
              else {
                setMobileView('panel');
                setPanelTab(tab);
              }
            }}
            className={`flex-1 py-2 text-xs font-medium capitalize ${
              (tab === 'editor' && mobileView === 'editor') || (tab !== 'editor' && mobileView === 'panel' && panelTab === tab)
                ? 'border-b-2 border-accent text-foreground'
                : 'text-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col min-h-0 md:flex-row">
        {/* Editor */}
        <div className={`min-h-[300px] flex-1 flex-col md:flex ${mobileView === 'editor' ? 'flex' : 'hidden'}`}>
          <Editor
            height="100%"
            language={monacoLanguageFor(language)}
            value={code}
            onChange={(value) => setCode(value ?? '')}
            theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
          />
          <div className="border-t border-border bg-surface p-2">
            <label className="mb-1 block text-xs font-medium text-muted">stdin</label>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              rows={2}
              placeholder="Input piped to the program's stdin…"
              className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Side panel */}
        <div
          className={`min-h-0 flex-col overflow-y-auto md:flex md:w-[420px] md:border-l md:border-border ${
            mobileView === 'panel' ? 'flex flex-1' : 'hidden'
          }`}
        >
          {/* On mobile the bottom tab bar already switches between output/skills, so this
              internal header is desktop-only to avoid two redundant sets of tabs. */}
          <div className="hidden border-b border-border md:flex">
            <button
              onClick={() => setPanelTab('output')}
              className={`flex-1 py-2 text-xs font-medium ${panelTab === 'output' ? 'border-b-2 border-accent text-foreground' : 'text-muted'}`}
            >
              Output
            </button>
            <button
              onClick={() => setPanelTab('skills')}
              className={`flex-1 py-2 text-xs font-medium ${panelTab === 'skills' ? 'border-b-2 border-accent text-foreground' : 'text-muted'}`}
            >
              Skills
            </button>
          </div>

          {panelTab === 'output' && (
            <div className="flex flex-1 flex-col gap-3 p-3 text-sm">
              {runError && <p className="text-red-500">{runError}</p>}
              {!runError && !runResult && !running && <p className="text-muted">Run the code to see output here.</p>}
              {running && <p className="text-muted">Executing…</p>}
              {runResult && (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="rounded bg-background px-2 py-0.5 border border-border">
                      {runResult.language} {runResult.version}
                    </span>
                    <span className="rounded bg-background px-2 py-0.5 border border-border">
                      exit code: {runResult.run.code ?? '—'}
                    </span>
                    {runResult.run.signal && (
                      <span className="rounded bg-background px-2 py-0.5 border border-border">signal: {runResult.run.signal}</span>
                    )}
                  </div>
                  {runResult.compile && (runResult.compile.stdout || runResult.compile.stderr) && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted">Compile output</p>
                      <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-2 font-mono text-xs">
                        {runResult.compile.stdout}
                        {runResult.compile.stderr}
                      </pre>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted">stdout</p>
                    <pre className="min-h-[2rem] whitespace-pre-wrap rounded-md border border-border bg-background p-2 font-mono text-xs">
                      {runResult.run.stdout || '(empty)'}
                    </pre>
                  </div>
                  {runResult.run.stderr && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted">stderr</p>
                      <pre className="whitespace-pre-wrap rounded-md border border-red-400/40 bg-background p-2 font-mono text-xs text-red-500">
                        {runResult.run.stderr}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {panelTab === 'skills' && (
            <div className="flex flex-1 flex-col gap-3 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={skill}
                  onChange={(e) => setSkill(e.target.value as Skill)}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {SKILLS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {skill === 'convert' && (
                  <input
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    placeholder="Target language"
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                )}
              </div>
              <button
                onClick={handleRunSkill}
                disabled={skillRunning}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
              >
                {skillRunning ? 'Thinking…' : 'Run skill'}
              </button>
              {skillError && <p className="text-red-500">{skillError}</p>}
              {skillResult && (
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-2 font-mono text-xs">
                  {skillResult}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
