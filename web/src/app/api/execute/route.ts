import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { executeCode, PistonError } from '@/lib/piston';

// Stateless execution endpoint: runs code without requiring a saved CodeProject.
// Useful for scratch/one-off runs in the editor before a project is saved.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const language = typeof body?.language === 'string' ? body.language : '';
  const code = typeof body?.code === 'string' ? body.code : '';
  const version = typeof body?.version === 'string' ? body.version : undefined;
  const stdin = typeof body?.stdin === 'string' ? body.stdin : undefined;

  if (!language) return NextResponse.json({ error: 'language is required' }, { status: 400 });

  try {
    const result = await executeCode({ language, version, code, stdin });
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof PistonError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Execution failed' }, { status: 502 });
  }
}
