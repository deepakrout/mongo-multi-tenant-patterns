require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const orderRepository = require('./patterns/shared/order.repository');

/**
 * Minimal demo server for the shared-collection pattern. Tenant is
 * resolved from a header here for simplicity — in production this
 * would come from a validated JWT claim or an API key lookup, never
 * a client-supplied header taken at face value.
 */
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const tenantId = req.header('x-tenant-id');
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing x-tenant-id header' });
  }
  req.tenantId = tenantId;
  next();
});

app.get('/orders/pending', async (req, res, next) => {
  try {
    const orders = await orderRepository.listPending(req.tenantId);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

app.post('/orders', async (req, res, next) => {
  try {
    const order = await orderRepository.create(req.tenantId, req.body);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Listening on :${port}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = app;
