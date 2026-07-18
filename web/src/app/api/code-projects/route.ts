import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await prisma.codeProject.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, language: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled project';
  const language = typeof body?.language === 'string' && body.language.trim() ? body.language.trim() : 'python';
  const code = typeof body?.code === 'string' ? body.code : '';
  const stdin = typeof body?.stdin === 'string' ? body.stdin : undefined;

  const project = await prisma.codeProject.create({
    data: { userId: user.id, name, language, code, stdin },
  });

  return NextResponse.json({ project }, { status: 201 });
}
