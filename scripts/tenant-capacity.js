#!/usr/bin/env node
/**
 * Tenant capacity calculator.
 *
 * Most multi-tenant MongoDB tutorials tell you "collection-per-tenant
 * doesn't scale" without putting a number on it. This script does the
 * arithmetic against MongoDB Atlas's documented, cluster-wide limits so
 * you can see exactly which tier you outgrow, and at how many tenants.
 *
 * Limits sourced from MongoDB's own docs (checked September 2026):
 *   - M0 (free):      500 collections total, 100 databases, 500 connections
 *     https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
 *   - M10:            ~5,000 collections+indexes (recommended max), 1,500 connections/node
 *   - M20/M30:        ~10,000 collections+indexes (recommended max)
 *   - M40+:           ~100,000 collections+indexes (recommended max)
 *     https://www.mongodb.com/docs/atlas/reference/atlas-limits/
 *
 * Usage:
 *   node scripts/tenant-capacity.js --collectionsPerTenant=4
 *   node scripts/tenant-capacity.js --collectionsPerTenant=4 --dbPerTenant
 */

const TIERS = [
  { name: 'M0 (free)', collectionLimit: 500, dbLimit: 100, connectionLimit: 500 },
  { name: 'M10', collectionLimit: 5000, dbLimit: null, connectionLimit: 1500 },
  { name: 'M20/M30', collectionLimit: 10000, dbLimit: null, connectionLimit: 3000 },
  { name: 'M40+', collectionLimit: 100000, dbLimit: null, connectionLimit: 6000 },
];

function parseArgs(argv) {
  const args = { collectionsPerTenant: 4, dbPerTenant: false };
  for (const arg of argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'collectionsPerTenant') args.collectionsPerTenant = Number(value);
    if (key === 'dbPerTenant') args.dbPerTenant = true;
  }
  return args;
}

function computeCapacity({ collectionsPerTenant, dbPerTenant }) {
  return TIERS.map((tier) => {
    const byCollections = Math.floor(tier.collectionLimit / collectionsPerTenant);
    const byDatabases = dbPerTenant && tier.dbLimit ? tier.dbLimit : Infinity;
    const maxTenants = Math.min(byCollections, byDatabases);
    const bindingConstraint =
      byDatabases < byCollections ? 'database count' : 'collection count';
    return {
      tier: tier.name,
      maxTenants: Number.isFinite(maxTenants) ? maxTenants : byCollections,
      bindingConstraint: dbPerTenant && tier.dbLimit ? bindingConstraint : 'collection count',
    };
  });
}

function printTable(rows, { collectionsPerTenant, dbPerTenant }) {
  const pattern = dbPerTenant ? 'database-per-tenant' : 'collection-per-tenant';
  console.log(`\nPattern: ${pattern} (${collectionsPerTenant} collections/tenant)\n`);
  console.log('Tier'.padEnd(12), 'Max tenants'.padEnd(14), 'Binding constraint');
  console.log('-'.repeat(50));
  for (const row of rows) {
    console.log(row.tier.padEnd(12), String(row.maxTenants).padEnd(14), row.bindingConstraint);
  }
  console.log('');
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const rows = computeCapacity(args);
  printTable(rows, args);
}

module.exports = { computeCapacity, TIERS };
