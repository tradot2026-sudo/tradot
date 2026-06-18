import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import SettingsClientView from './SettingsClientView';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }
  const userId = (session.user as { id: string }).id;

  // Initial count of user entities for rendering
  const [clientsCount, plansCount, payoutsCount] = await Promise.all([
    prisma.client.count({ where: { createdBy: userId } }),
    prisma.plan.count({ where: { createdBy: userId } }),
    prisma.payout.count({ where: { plan: { createdBy: userId } } }),
  ]);

  const initialCounts = {
    clients: clientsCount,
    plans: plansCount,
    payouts: payoutsCount,
  };

  return <SettingsClientView initialCounts={initialCounts} />;
}
