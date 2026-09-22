const mongoose = require('mongoose');

/**
 * DATABASE-PER-TENANT PATTERN
 * ---------------------------------------------------------------
 * Each tenant gets its own logical database on the same cluster
 * (mongodb+srv://cluster/tenant_<id>). Isolation is physical, not
 * just a query filter — a bug that drops a collection can't touch
 * another tenant's database.
 *
 * The gotcha: mongoose.createConnection() opens a real connection
 * pool per call. A naive implementation that opens a fresh
 * connection per request will exhaust Atlas's per-node connection
 * limit long before it exhausts CPU or storage. On an M10 (1,500
 * connections per node), 50 concurrent requests per tenant across
 * 30 tenants without pooling/caching is already 1,500 connections —
 * you hit the ceiling with a caching layer this thin.
 *
 * This manager caches one connection per tenant and reuses it,
 * with an LRU-style eviction so idle tenants don't hold pools open
 * forever on a cluster serving hundreds of tenants.
 */
class TenantConnectionManager {
  constructor({ baseUri, maxCachedConnections = 50, poolSize = 5 }) {
    this.baseUri = baseUri;
    this.maxCachedConnections = maxCachedConnections;
    this.poolSize = poolSize;
    this.connections = new Map(); // tenantId -> { conn, lastUsed }
  }

  async getConnection(tenantId) {
    const cached = this.connections.get(tenantId);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.conn;
    }

    if (this.connections.size >= this.maxCachedConnections) {
      this._evictOldest();
    }

    const dbName = `tenant_${tenantId}`;
    const conn = await mongoose.createConnection(`${this.baseUri}/${dbName}`, {
      maxPoolSize: this.poolSize,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
    }).asPromise();

    this.connections.set(tenantId, { conn, lastUsed: Date.now() });
    return conn;
  }

  _evictOldest() {
    let oldestTenant = null;
    let oldestTime = Infinity;
    for (const [tenantId, entry] of this.connections) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestTenant = tenantId;
      }
    }
    if (oldestTenant) {
      const { conn } = this.connections.get(oldestTenant);
      conn.close().catch(() => {});
      this.connections.delete(oldestTenant);
    }
  }

  async closeAll() {
    await Promise.all([...this.connections.values()].map(({ conn }) => conn.close()));
    this.connections.clear();
  }
}

module.exports = TenantConnectionManager;
