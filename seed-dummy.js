const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { addDays, subDays, format } = require('date-fns');

const DUMMY_TAG = '[DUMMY_DATA]';

async function clean() {
  console.log('Cleaning up dummy data...');

  // Delete payouts associated with dummy plans or with dummy notes
  const deletedPayouts = await prisma.payout.deleteMany({
    where: {
      OR: [
        { notes: { contains: DUMMY_TAG } },
        { plan: { notes: { contains: DUMMY_TAG } } },
        { plan: { client: { notes: { contains: DUMMY_TAG } } } }
      ]
    }
  });
  console.log(`Deleted ${deletedPayouts.count} dummy payouts.`);

  // Delete plans associated with dummy clients or with dummy notes
  const deletedPlans = await prisma.plan.deleteMany({
    where: {
      OR: [
        { notes: { contains: DUMMY_TAG } },
        { client: { notes: { contains: DUMMY_TAG } } }
      ]
    }
  });
  console.log(`Deleted ${deletedPlans.count} dummy plans.`);

  // Delete dummy clients
  const deletedClients = await prisma.client.deleteMany({
    where: {
      notes: { contains: DUMMY_TAG }
    }
  });
  console.log(`Deleted ${deletedClients.count} dummy clients.`);

  console.log('Cleanup complete!');
}

async function seed() {
  console.log('Seeding dummy data...');

  // Get all users
  const users = await prisma.user.findMany();
  if (users.length === 0) {
    console.error('No users found in database. Please register/create a user first.');
    return;
  }

  const today = new Date();
  const formatD = (date) => format(date, 'yyyy-MM-dd');

  // Dummy clients details
  const clientTemplates = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '9876543210', address: 'Mumbai, India' },
    { name: 'Aditi Patel', email: 'aditi.patel@example.com', phone: '9876543211', address: 'Ahmedabad, India' },
    { name: 'Rohan Gupta', email: 'rohan.gupta@example.com', phone: '9876543212', address: 'Delhi, India' },
    { name: 'Kavya Iyer', email: 'kavya.iyer@example.com', phone: '9876543213', address: 'Chennai, India' },
    { name: 'Sai Reddy', email: 'sai.reddy@example.com', phone: '9876543214', address: 'Hyderabad, India' },
    { name: 'Ananya Das', email: 'ananya.das@example.com', phone: '9876543215', address: 'Kolkata, India' },
    { name: 'Vikram Singh', email: 'vikram.singh@example.com', phone: '9876543216', address: 'Jaipur, India' },
    { name: 'Pooja Rao', email: 'pooja.rao@example.com', phone: '9876543217', address: 'Bengaluru, India' },
    { name: 'Arjun Verma', email: 'arjun.verma@example.com', phone: '9876543218', address: 'Pune, India' },
    { name: 'Meera Nair', email: 'meera.nair@example.com', phone: '9876543219', address: 'Kochi, India' }
  ];

  for (const user of users) {
    console.log(`Seeding for user: ${user.email} (${user.id})...`);

    for (let i = 0; i < clientTemplates.length; i++) {
      const template = clientTemplates[i];

      // 1. Create Client
      const client = await prisma.client.create({
        data: {
          name: template.name,
          email: template.email,
          phone: template.phone,
          address: template.address,
          notes: `Dummy client created for testing. ${DUMMY_TAG}`,
          createdBy: user.id
        }
      });

      // 2. Create Plan
      const principal = 100000 + i * 50000;
      const interestRate = 0.02; // 2%
      const expectedAmount = principal * interestRate;

      const plan = await prisma.plan.create({
        data: {
          clientId: client.id,
          planName: `Growth Plan #${i + 1}`,
          principalAmount: principal,
          payoutType: 'monthly',
          payoutAmount: expectedAmount,
          startDate: formatD(subDays(today, 30)),
          status: 'active',
          createdBy: user.id,
          notes: `Test Growth Plan with dummy payouts. ${DUMMY_TAG}`
        }
      });

      // 3. Create Payouts with different relative due dates to test fund tracker dashboards
      // We will create different types of payouts per plan:
      // Client 0 & 5: Overdue payout (5 days ago, No Action)
      // Client 1 & 6: Due Today (No Action)
      // Client 2 & 7: Due Tomorrow (Withdrawal Requested)
      // Client 3 & 8: Due in 2 Days (Credited)
      // Client 4 & 9: Future Payout (15 days ahead)
      let dueDate;
      let fundStatus = null;
      let fundStatusDate = null;

      if (i === 0 || i === 5) {
        dueDate = subDays(today, 5); // Overdue
      } else if (i === 1 || i === 6) {
        dueDate = today; // Due today
      } else if (i === 2 || i === 7) {
        dueDate = addDays(today, 1); // Due tomorrow
        fundStatus = 'withdrawal_requested';
        fundStatusDate = formatD(subDays(today, 1));
      } else if (i === 3 || i === 8) {
        dueDate = addDays(today, 2); // Due in 2 days
        fundStatus = 'credited';
        fundStatusDate = formatD(today);
      } else {
        dueDate = addDays(today, 15); // Future
      }

      await prisma.payout.create({
        data: {
          planId: plan.id,
          dueDate: formatD(dueDate),
          expectedAmount,
          status: 'pending',
          payoutNumber: 1,
          fundStatus,
          fundStatusDate,
          notes: `Test Payout #${i + 1}. ${DUMMY_TAG}`
        }
      });
    }
  }

  console.log('Seeding complete! 10 clients and plans added successfully.');
}

async function run() {
  const args = process.argv.slice(2);
  if (args.includes('--clean') || args.includes('-c') || args.includes('--delete')) {
    await clean();
  } else {
    // Clean first to avoid duplicate seeds
    await clean();
    await seed();
  }
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
