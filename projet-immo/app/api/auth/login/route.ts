import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // Create token (1 hour TTL)
  const token = randomBytes(32).toString('hex');
  await prisma.token.create({
    data: {
      token,
      email,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

  // In production: send email. In dev: return link directly.
  if (process.env.NODE_ENV === 'production') {
    // TODO: send email with verifyUrl
    return NextResponse.json({ message: 'Email envoyé' });
  }

  return NextResponse.json({ devLink: verifyUrl, userId: user.id });
}
