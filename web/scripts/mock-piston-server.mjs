/**
 * TEST-ONLY mock of Piston's HTTP API contract, backed by directly-installed host runtimes
 * (python3/node/gcc). This is NOT a sandbox and must never be used in production - it exists
 * solely to verify src/lib/piston.ts's request/response handling against a real HTTP server
 * in this dev sandbox, where pulling the real Piston Docker image is blocked by network policy.
 * Production deployments must use docker-compose.piston.yml (the real, isolated Piston engine).
 */
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUNTIMES = [
  { language: 'python', version: '3.11.15', aliases: ['py', 'python3'] },
  { language: 'javascript', version: '22.22.2', aliases: ['js', 'node'] },
  { language: 'c++', version: '13.3.0', aliases: ['cpp', 'g++'] },
];

function runCode(language, code, stdin) {
  const dir = mkdtempSync(join(tmpdir(), 'mockpiston-'));
  try {
    if (language === 'python') {
      const file = join(dir, 'main.py');
      writeFileSync(file, code);
      const r = spawnSync('python3', [file], { input: stdin || '', timeout: 5000, encoding: 'utf8' });
      return { stdout: r.stdout || '', stderr: r.stderr || '', code: r.status };
    }
    if (language === 'javascript') {
      const file = join(dir, 'main.js');
      writeFileSync(file, code);
      const r = spawnSync('node', [file], { input: stdin || '', timeout: 5000, encoding: 'utf8' });
      return { stdout: r.stdout || '', stderr: r.stderr || '', code: r.status };
    }
    if (language === 'c++') {
      const src = join(dir, 'main.cpp');
      const bin = join(dir, 'main');
      writeFileSync(src, code);
      const compile = spawnSync('g++', [src, '-o', bin], { timeout: 10000, encoding: 'utf8' });
      if (compile.status !== 0) {
        return { stdout: '', stderr: compile.stderr || '', code: compile.status, compileFailed: true, compileStderr: compile.stderr };
      }
      const r = spawnSync(bin, [], { input: stdin || '', timeout: 5000, encoding: 'utf8' });
      return { stdout: r.stdout || '', stderr: r.stderr || '', code: r.status };
    }
    throw new Error(`Unsupported mock language: ${language}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/v2/runtimes') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(RUNTIMES));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/v2/execute') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const code = payload.files?.[0]?.content || '';
        const result = runCode(payload.language, code, payload.stdin);

        const responseBody = {
          language: payload.language,
          version: payload.version === '*' ? RUNTIMES.find((r) => r.language === payload.language)?.version : payload.version,
          run: {
            stdout: result.stdout,
            stderr: result.compileFailed ? '' : result.stderr,
            output: result.compileFailed ? '' : result.stdout + result.stderr,
            code: result.compileFailed ? null : result.code,
            signal: null,
          },
          ...(result.compileFailed
            ? { compile: { stdout: '', stderr: result.compileStderr, output: result.compileStderr, code: result.code, signal: null } }
            : {}),
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseBody));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const port = process.env.MOCK_PISTON_PORT || 2000;
server.listen(port, () => console.log(`[mock-piston] listening on :${port} (TEST ONLY, not a sandbox)`));
