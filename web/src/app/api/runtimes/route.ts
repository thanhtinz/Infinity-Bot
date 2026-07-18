import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { listRuntimes, PistonError } from '@/lib/piston';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const runtimes = await listRuntimes();
    return NextResponse.json({ runtimes });
  } catch (err) {
    if (err instanceof PistonError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Failed to load runtimes' }, { status: 502 });
  }
}
