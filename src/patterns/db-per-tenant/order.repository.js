const orderSchema = require('./order.model');

class DbPerTenantOrderRepository {
  constructor(connectionManager) {
    this.connectionManager = connectionManager;
  }

  async _model(tenantId) {
    const conn = await this.connectionManager.getConnection(tenantId);
    // Mongoose caches models per connection, so repeated calls are cheap.
    return conn.models.Order || conn.model('Order', orderSchema);
  }

  async listPending(tenantId, { limit = 25 } = {}) {
    const Order = await this._model(tenantId);
    return Order.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async create(tenantId, orderData) {
    const Order = await this._model(tenantId);
    return Order.create(orderData);
  }
}

module.exports = DbPerTenantOrderRepository;
