import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { executeCode, PistonError } from '@/lib/piston';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const project = await prisma.codeProject.findUnique({ where: { id } });
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Allow an optional per-run version/stdin override without mutating the saved project.
  const body = await request.json().catch(() => ({}));
  const version = typeof body?.version === 'string' ? body.version : undefined;
  const stdin = typeof body?.stdin === 'string' ? body.stdin : project.stdin ?? undefined;

  const startedAt = Date.now();

  try {
    const result = await executeCode({
      language: project.language,
      version,
      code: project.code,
      stdin,
    });
    const durationMs = Date.now() - startedAt;

    const execution = await prisma.codeExecution.create({
      data: {
        projectId: project.id,
        language: result.language,
        version: result.version,
        stdout: result.run.stdout,
        stderr: result.run.stderr,
        exitCode: result.run.code,
        durationMs,
      },
    });

    return NextResponse.json({ execution, result });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    if (err instanceof PistonError) {
      await prisma.codeExecution.create({
        data: {
          projectId: project.id,
          language: project.language,
          stderr: err.message,
          durationMs,
        },
      }).catch(() => {});
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Execution failed' }, { status: 502 });
  }
}
