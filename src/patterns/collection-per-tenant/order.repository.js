const mongoose = require('mongoose');

/**
 * COLLECTION-PER-TENANT PATTERN
 * ---------------------------------------------------------------
 * Single database, but each tenant gets its own collection
 * (orders_<tenantId>). This is the pattern people reach for when
 * they want "some" isolation without the connection-pool overhead
 * of a full database-per-tenant setup.
 *
 * It has the worst scaling ceiling of the three. Collections carry
 * their own metadata and index overhead, and Atlas's collection
 * count limits are cluster-wide, not per-tenant — see the
 * capacity calculator in scripts/tenant-capacity.js. A schema with
 * 4 collections per tenant (orders, customers, products, sessions)
 * caps out at ~125 tenants on an M0 free/dev cluster purely on the
 * 500-collection ceiling, regardless of how little data each tenant
 * actually has.
 */
const orderSchemaDefinition = {
  customerEmail: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'fulfilled', 'refunded'],
    default: 'pending',
  },
  totalCents: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
};

class CollectionPerTenantOrderRepository {
  constructor(connection = mongoose.connection) {
    this.connection = connection;
    this._models = new Map();
  }

  _model(tenantId) {
    const collectionName = `orders_${tenantId}`;
    if (this._models.has(collectionName)) {
      return this._models.get(collectionName);
    }
    const schema = new mongoose.Schema(orderSchemaDefinition, { versionKey: false });
    schema.index({ status: 1, createdAt: -1 });
    const model = this.connection.model(collectionName, schema, collectionName);
    this._models.set(collectionName, model);
    return model;
  }

  async listPending(tenantId, { limit = 25 } = {}) {
    return this._model(tenantId).find({ status: 'pending' }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async create(tenantId, orderData) {
    return this._model(tenantId).create(orderData);
  }
}

module.exports = CollectionPerTenantOrderRepository;
