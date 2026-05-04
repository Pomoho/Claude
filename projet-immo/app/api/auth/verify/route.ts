import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 });

  const record = await prisma.token.findUnique({ where: { token } });
  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 400 });
  }

  await prisma.token.update({ where: { token }, data: { used: true } });

  const user = await prisma.user.findUnique({ where: { email: record.email } });
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 400 });

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();

  return NextResponse.json({ ok: true, userId: user.id });
}
