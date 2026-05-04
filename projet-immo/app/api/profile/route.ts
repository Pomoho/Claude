import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
  if (!profile) return NextResponse.json({ profile: null });

  // Deserialize movingReasons from JSON string
  return NextResponse.json({
    profile: {
      ...profile,
      movingReasons: profile.movingReasons ? JSON.parse(profile.movingReasons) : [],
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const data = await req.json();

  // Serialize movingReasons array to JSON string for SQLite storage
  const serialized = {
    ...data,
    movingReasons: Array.isArray(data.movingReasons)
      ? JSON.stringify(data.movingReasons)
      : data.movingReasons ?? '[]',
  };

  const profile = await prisma.profile.upsert({
    where: { userId: session.userId },
    update: serialized,
    create: { userId: session.userId, ...serialized },
  });

  return NextResponse.json({
    profile: {
      ...profile,
      movingReasons: profile.movingReasons ? JSON.parse(profile.movingReasons) : [],
    },
  });
}
