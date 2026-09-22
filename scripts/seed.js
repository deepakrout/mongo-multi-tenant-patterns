require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../src/patterns/shared/order.model');

const TENANTS = [
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Seeding demo orders for 3 tenants...');

  await Order.deleteMany({ tenantId: { $in: TENANTS } });

  const docs = [];
  for (const tenantId of TENANTS) {
    for (let i = 0; i < 20; i++) {
      docs.push({
        tenantId,
        customerEmail: `customer${i}@example.com`,
        status: i % 4 === 0 ? 'pending' : 'paid',
        totalCents: 1000 + i * 137,
        lineItems: [{ sku: `SKU-${i}`, quantity: 1, unitPriceCents: 1000 + i * 137 }],
      });
    }
  }

  await Order.insertMany(docs);
  console.log(`Inserted ${docs.length} orders across ${TENANTS.length} tenants.`);
  console.log('Tenant IDs:', TENANTS.map(String));

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
