const Order = require('./order.model');

/**
 * Every method takes tenantId as its first, non-optional argument.
 * This is the API-design half of tenant isolation: make it structurally
 * awkward to write a query that forgets to scope by tenant.
 */
class OrderRepository {
  async listPending(tenantId, { limit = 25 } = {}) {
    return Order.find({ tenantId, status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async findByCustomer(tenantId, customerEmail) {
    return Order.find({ tenantId, customerEmail }).lean();
  }

  async create(tenantId, orderData) {
    return Order.create({ ...orderData, tenantId });
  }

  async markFulfilled(tenantId, orderId) {
    return Order.findOneAndUpdate(
      { _id: orderId, tenantId },
      { $set: { status: 'fulfilled' } },
      { new: true }
    );
  }
}

module.exports = new OrderRepository();
