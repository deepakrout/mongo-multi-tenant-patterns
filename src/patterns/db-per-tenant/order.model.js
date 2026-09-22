const { Schema } = require('mongoose');

/**
 * Same schema shape as the shared-collection pattern, but note there's
 * no tenantId field here — physical separation means the database
 * itself is the tenant boundary. Register this schema against a
 * per-tenant connection with connection.model('Order', orderSchema).
 */
const orderSchema = new Schema(
  {
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

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customerEmail: 1 });

module.exports = orderSchema;
