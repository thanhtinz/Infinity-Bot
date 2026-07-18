import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

// GET: list the current user's conversations, most recently updated first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conversations = await prisma.chatConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ conversations });
}

// POST: create a new conversation, optionally with a title.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : undefined;

  const conversation = await prisma.chatConversation.create({
    data: { userId: user.id, ...(title ? { title } : {}) },
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
