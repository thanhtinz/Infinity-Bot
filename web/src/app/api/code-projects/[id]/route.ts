import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

async function loadOwnedProject(userId: string, id: string) {
  const project = await prisma.codeProject.findUnique({ where: { id } });
  if (!project || project.userId !== userId) return null;
  return project;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const project = await loadOwnedProject(user.id, id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await loadOwnedProject(user.id, id);
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const data: { name?: string; language?: string; code?: string; stdin?: string | null } = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.language === 'string' && body.language.trim()) data.language = body.language.trim();
  if (typeof body.code === 'string') data.code = body.code;
  if (typeof body.stdin === 'string' || body.stdin === null) data.stdin = body.stdin;

  const project = await prisma.codeProject.update({ where: { id }, data });

  return NextResponse.json({ project });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await loadOwnedProject(user.id, id);
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  await prisma.codeProject.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
