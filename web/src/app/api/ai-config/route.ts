import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { encrypt, decrypt, maskKey } from '@/lib/crypto';
import { SUPPORTED_PROVIDERS } from '@/lib/ai';

function isSupportedProvider(value: unknown): value is string {
  return typeof value === 'string' && SUPPORTED_PROVIDERS.includes(value);
}

// GET: list the current user's configured providers. Never returns raw or encrypted keys.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const configs = await prisma.userAIConfig.findMany({
    where: { userId: user.id },
    orderBy: { provider: 'asc' },
  });

  return NextResponse.json({
    configs: configs.map((c) => ({
      provider: c.provider,
      preferredModel: c.preferredModel,
      isActive: c.isActive,
      maskedKey: maskKey(safeDecryptForMask(c.encryptedKey)),
      updatedAt: c.updatedAt,
    })),
  });
}

// A masked key only ever needs the last few characters; if decryption somehow
// fails (e.g. key rotated), fall back to a fixed-length mask rather than throwing.
function safeDecryptForMask(encryptedKey: string): string {
  try {
    return decrypt(encryptedKey);
  } catch {
    return '????????????';
  }
}

// POST: create or update the key (and optionally preferredModel / isActive) for a provider.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  const preferredModel = typeof body?.preferredModel === 'string' && body.preferredModel.trim() ? body.preferredModel.trim() : undefined;
  const isActive = body?.isActive === true;

  if (!isSupportedProvider(provider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
  }

  const encryptedKey = encrypt(apiKey);

  const saved = await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.userAIConfig.updateMany({
        where: { userId: user.id, provider: { not: provider }, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.userAIConfig.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      create: {
        userId: user.id,
        provider,
        encryptedKey,
        preferredModel,
        isActive,
      },
      update: {
        encryptedKey,
        ...(preferredModel !== undefined ? { preferredModel } : {}),
        ...(isActive ? { isActive: true } : {}),
      },
    });
  });

  return NextResponse.json({
    provider: saved.provider,
    preferredModel: saved.preferredModel,
    isActive: saved.isActive,
    maskedKey: maskKey(apiKey),
  });
}

// PATCH: update preferredModel and/or isActive for an existing provider config, without
// resubmitting the API key. Setting isActive: true unsets any other active row for the user.
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  const hasPreferredModel = typeof body?.preferredModel === 'string';
  const preferredModel = hasPreferredModel ? (body.preferredModel.trim() || null) : undefined;
  const hasIsActive = typeof body?.isActive === 'boolean';
  const isActive = body?.isActive === true;

  if (!isSupportedProvider(provider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }

  const existing = await prisma.userAIConfig.findUnique({
    where: { userId_provider: { userId: user.id, provider } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'No key configured for this provider yet' }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (hasIsActive && isActive) {
      await tx.userAIConfig.updateMany({
        where: { userId: user.id, provider: { not: provider }, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.userAIConfig.update({
      where: { userId_provider: { userId: user.id, provider } },
      data: {
        ...(hasPreferredModel ? { preferredModel } : {}),
        ...(hasIsActive ? { isActive } : {}),
      },
    });
  });

  return NextResponse.json({
    provider: updated.provider,
    preferredModel: updated.preferredModel,
    isActive: updated.isActive,
  });
}

// DELETE: remove a provider's stored key. Accepts ?provider=... or a JSON body.
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let provider: unknown = request.nextUrl.searchParams.get('provider');
  if (!provider) {
    const body = await request.json().catch(() => null);
    provider = body?.provider;
  }

  if (!isSupportedProvider(provider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }

  const existing = await prisma.userAIConfig.findUnique({
    where: { userId_provider: { userId: user.id, provider } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'No key configured for this provider' }, { status: 404 });
  }

  await prisma.userAIConfig.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
