import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { chat, NoActiveKeyError } from '@/lib/ai';

const SKILLS = ['explain', 'debug', 'optimize', 'convert', 'generate-tests', 'add-comments'] as const;
type Skill = (typeof SKILLS)[number];

function buildSystemPrompt(skill: Skill, language: string, targetLanguage?: string): string {
  switch (skill) {
    case 'explain':
      return `You are a code review assistant. Explain what this ${language} code does clearly and concisely.`;
    case 'debug':
      return `Find and explain bugs in this ${language} code, and provide a corrected version.`;
    case 'optimize':
      return `Suggest and provide a more efficient version of this ${language} code, explaining the improvement.`;
    case 'convert':
      return `Convert this ${language} code to ${targetLanguage}, preserving behavior exactly.`;
    case 'generate-tests':
      return `Write a thorough test suite for this ${language} code using an idiomatic testing framework for its language.`;
    case 'add-comments':
      return `Add clear, concise comments to this ${language} code explaining non-obvious logic only - do not restate what the code visibly does.`;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const project = await prisma.codeProject.findUnique({ where: { id } });
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const skill = body?.skill;
  if (!SKILLS.includes(skill)) {
    return NextResponse.json({ error: `skill must be one of: ${SKILLS.join(', ')}` }, { status: 400 });
  }

  const targetLanguage = typeof body?.targetLanguage === 'string' ? body.targetLanguage.trim() : undefined;
  if (skill === 'convert' && !targetLanguage) {
    return NextResponse.json({ error: 'targetLanguage is required for the convert skill' }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(skill, project.language, targetLanguage);

  try {
    const result = await chat(user.id, [{ role: 'user', content: project.code }], { systemPrompt });
    return NextResponse.json({ skill, text: result.text });
  } catch (err) {
    if (err instanceof NoActiveKeyError) {
      return NextResponse.json({ error: 'No active AI provider key configured for your account.', code: err.code }, { status: 400 });
    }
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
  }
}
