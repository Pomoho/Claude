import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const alerts = await prisma.alert.findMany({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const data = await req.json();
  const alert = await prisma.alert.create({ data: { userId: session.userId, ...data } });
  return NextResponse.json({ alert });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await req.json();
  await prisma.alert.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
