/**
 * Client for a self-hosted Piston (https://github.com/engineer-man/piston) instance -
 * an open-source, purpose-built sandboxed code execution engine supporting 60+ languages.
 * This app never executes user code directly; it always proxies to Piston's isolated,
 * resource-limited containers (see docker-compose.piston.yml to self-host it).
 */

const PISTON_API_URL = process.env.PISTON_API_URL || 'http://localhost:2000';

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

export interface PistonExecuteResult {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    output: string;
    code: number | null;
    signal: string | null;
  };
  compile?: {
    stdout: string;
    stderr: string;
    output: string;
    code: number | null;
    signal: string | null;
  };
}

export class PistonError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'PistonError';
  }
}

let runtimesCache: { data: PistonRuntime[]; ts: number } | null = null;
const RUNTIMES_CACHE_TTL = 60 * 60 * 1000; // 1 hour, runtimes rarely change

export async function listRuntimes(): Promise<PistonRuntime[]> {
  if (runtimesCache && Date.now() - runtimesCache.ts < RUNTIMES_CACHE_TTL) {
    return runtimesCache.data;
  }

  const res = await fetch(`${PISTON_API_URL}/api/v2/runtimes`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new PistonError(`Failed to fetch runtimes (${res.status})`, res.status);
  const data = (await res.json()) as PistonRuntime[];
  runtimesCache = { data, ts: Date.now() };
  return data;
}

export interface ExecuteOptions {
  language: string;
  version?: string;
  code: string;
  filename?: string;
  stdin?: string;
  args?: string[];
}

export async function executeCode(opts: ExecuteOptions): Promise<PistonExecuteResult> {
  const version = opts.version || '*';

  const res = await fetch(`${PISTON_API_URL}/api/v2/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: opts.language,
      version,
      files: [{ name: opts.filename, content: opts.code }],
      stdin: opts.stdin || '',
      args: opts.args || [],
      compile_timeout: 10000,
      run_timeout: 5000,
      compile_memory_limit: -1,
      run_memory_limit: -1,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new PistonError(`Piston execute failed (${res.status}): ${body}`, res.status);
  }

  return (await res.json()) as PistonExecuteResult;
}
