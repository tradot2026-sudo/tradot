import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      whatsappTemplatePaid: true,
      whatsappTemplateReminder: true,
    },
  });

  return NextResponse.json(user || { whatsappTemplatePaid: null, whatsappTemplateReminder: null });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      whatsappTemplatePaid: body.whatsappTemplatePaid === undefined ? undefined : (body.whatsappTemplatePaid || null),
      whatsappTemplateReminder: body.whatsappTemplateReminder === undefined ? undefined : (body.whatsappTemplateReminder || null),
    },
    select: {
      whatsappTemplatePaid: true,
      whatsappTemplateReminder: true,
    },
  });

  return NextResponse.json(updated);
}
