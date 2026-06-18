import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import ClientsClientView from './ClientsClientView';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }
  const userId = (session.user as { id: string }).id;

  const dbClients = await prisma.client.findMany({
    where: { createdBy: userId },
    include: { plans: { select: { id: true, principalAmount: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const enrichedClients = dbClients.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    notes: c.notes ?? undefined,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    planCount: c.plans?.length || 0,
    totalInvested: c.plans?.reduce((s, p) => s + (p.principalAmount || 0), 0) || 0,
  }));

  return <ClientsClientView initialClients={enrichedClients} />;
}
