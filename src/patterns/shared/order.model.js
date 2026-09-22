const { Schema, model } = require('mongoose');

/**
 * SHARED-COLLECTION PATTERN
 * ---------------------------------------------------------------
 * Every tenant's documents live in the same physical collection.
 * Isolation is enforced in the application layer (and optionally
 * MongoDB's queryable encryption / field-level security), never
 * by physical separation.
 *
 * The load-bearing design decision is the compound index below:
 * tenantId MUST be the first field in every compound index that
 * backs a tenant-scoped query. MongoDB uses a compound index's
 * prefix to narrow the scan, so { tenantId: 1, status: 1, createdAt: -1 }
 * lets a query for "tenant X's pending orders, newest first" walk a
 * tight index range instead of scanning every tenant's documents
 * and filtering in memory.
 *
 * Get the field order wrong — say, { status: 1, tenantId: 1 } — and
 * a five-tenant proof of concept will look fine, then silently fall
 * over at tenant #40 because the index prefix (status) has terrible
 * selectivity across the whole collection.
 */
const orderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    customerEmail: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'fulfilled', 'refunded'],
      default: 'pending',
    },
    lineItems: [
      {
        sku: String,
        quantity: Number,
        unitPriceCents: Number,
      },
    ],
    totalCents: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// tenantId-first compound indexes back every tenant-scoped access pattern.
orderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, customerEmail: 1 });

// Defense in depth: a Mongoose query middleware that refuses to run
// any find/count/update without a tenantId in the filter. This turns
// "the engineer forgot to scope the query" from a cross-tenant data
// leak into a thrown error in CI.
function requireTenantScope() {
  return function (next) {
    const filter = this.getFilter();
    if (!filter.tenantId) {
      return next(
        new Error(
          `Refusing to run ${this.op} on Order without a tenantId filter. ` +
            'Every query against a shared collection must be explicitly tenant-scoped.'
        )
      );
    }
    next();
  };
}

['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'countDocuments', 'updateMany', 'deleteMany'].forEach(
  (hook) => orderSchema.pre(hook, requireTenantScope())
);

module.exports = model('Order', orderSchema);
