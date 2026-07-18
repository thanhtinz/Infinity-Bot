import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { chat, NoActiveKeyError } from '@/lib/ai';

const SYSTEM_PROMPT = 'You are a helpful AI assistant inside a personal chat app. Be concise and friendly.';

// POST: append a user message to the conversation, ask the AI for a reply using the
// full message history, then persist and return both messages.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const conversation = await prisma.chatConversation.findFirst({ where: { id, userId: user.id } });
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const userMessage = await prisma.chatMessage.create({
    data: { conversationId: conversation.id, role: 'user', content },
  });

  const history = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
  });

  try {
    const result = await chat(
      user.id,
      history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { systemPrompt: SYSTEM_PROMPT }
    );

    const assistantMessage = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: result.text },
    });

    const titleUpdate = conversation.title === 'New chat' ? { title: content.slice(0, 60) } : {};
    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date(), ...titleUpdate },
    });

    return NextResponse.json({ userMessage, assistantMessage });
  } catch (error) {
    if (error instanceof NoActiveKeyError) {
      return NextResponse.json(
        {
          error: 'NO_ACTIVE_KEY',
          message: 'No AI API key configured. Add one in Settings to start chatting.',
          userMessage,
        },
        { status: 400 }
      );
    }

    console.error('Failed to get AI reply:', error);
    return NextResponse.json(
      { error: 'AI_ERROR', message: 'Something went wrong talking to the AI provider. Please try again.', userMessage },
      { status: 502 }
    );
  }
}
