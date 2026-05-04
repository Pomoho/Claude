import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const data = await req.json();

  const profile = await prisma.profile.upsert({
    where: { userId: session.userId },
    update: data,
    create: { userId: session.userId, ...data },
  });

  return NextResponse.json({ profile });
}
