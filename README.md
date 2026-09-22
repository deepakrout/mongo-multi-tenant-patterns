# mongo-multi-tenant-patterns

Working, runnable reference implementations of the three multi-tenant MongoDB schema patterns — **shared-collection**, **database-per-tenant**, and **collection-per-tenant** — plus a small calculator that puts real numbers on how many tenants each pattern supports before you hit an Atlas cluster's documented limits.

Companion code for the [Siloscape](https://siloscape.com) tutorial *"Multi-Tenant Schema Design Patterns in MongoDB."*

## Why this exists

Most multi-tenant MongoDB write-ups describe the three patterns and stop. This repo runs the math: given N collections per tenant, exactly how many tenants fit on an M0, M10, M20/M30, or M40+ Atlas cluster before you hit the collection-count or database-count ceiling — using MongoDB's own documented limits, not guesses.

```
$ npm run capacity -- --collectionsPerTenant=4

Pattern: collection-per-tenant (4 collections/tenant)

Tier         Max tenants    Binding constraint
--------------------------------------------------
M0 (free)    125            collection count
M10          1250           collection count
M20/M30      2500           collection count
M40+         25000          collection count
```

```
$ npm run capacity -- --collectionsPerTenant=4 --dbPerTenant

Pattern: database-per-tenant (4 collections/tenant)

Tier         Max tenants    Binding constraint
--------------------------------------------------
M0 (free)    100            database count
M10          1250           collection count
M20/M30      2500           collection count
M40+         25000          collection count
```

The database-per-tenant row on M0 is the one that surprises people: Atlas's free tier caps out at **100 databases per cluster**, full stop — independent of collections per tenant. If you're prototyping database-per-tenant on a free cluster, your tenant ceiling isn't "however much data fits in 512MB," it's **100 tenants**, flat.

## Repo structure

```
src/
  patterns/
    shared/                 # Pattern 1 — shared collection, tenantId-scoped
      order.model.js        # Schema + tenantId-first compound indexes + a
                             # query middleware that refuses unscoped queries
      order.repository.js   # Repository API where tenantId is a required arg
    db-per-tenant/           # Pattern 2 — one logical database per tenant
      connection-manager.js # LRU-capped per-tenant connection pool cache
      order.model.js
      order.repository.js
    collection-per-tenant/  # Pattern 3 — one collection per tenant, shared db
      order.repository.js
  index.js                  # Minimal Express server demoing the shared pattern
scripts/
  seed.js                   # Seeds demo orders for 3 tenants (shared pattern)
  tenant-capacity.js        # The capacity calculator shown above
```

## Prerequisites

- Node.js 18+
- A MongoDB cluster reachable from your machine — [Atlas free tier](https://www.mongodb.com/cloud/atlas/register) works fine for the shared-collection demo. Database-per-tenant and collection-per-tenant patterns are shown as reviewable code (connection manager, repositories); wiring them into `src/index.js` is left as a documented extension point since they need a real dedicated-tier cluster to demonstrate meaningfully.

## Setup

```bash
git clone https://github.com/deepakrout/mongo-multi-tenant-patterns.git
cd mongo-multi-tenant-patterns
npm install
cp .env.example .env
# edit .env with your MongoDB connection string
```

## Running the shared-collection demo

```bash
npm run seed     # inserts demo orders for 3 tenants
npm start        # starts the API on :3000
```

Then, with a tenant ID printed by the seed script:

```bash
curl http://localhost:3000/orders/pending \
  -H "x-tenant-id: <tenant-id-from-seed-output>"
```

Try omitting the header, or swapping in a tenant ID that doesn't exist, to see the tenant-scoping guardrails in `order.model.js` and the Express middleware in `index.js` at work.

## Running the capacity calculator

```bash
npm run capacity -- --collectionsPerTenant=<n> [--dbPerTenant]
```

- `--collectionsPerTenant` — how many collections your schema needs per tenant (e.g. 4 for orders/customers/products/sessions)
- `--dbPerTenant` — model the database-per-tenant pattern (adds the per-cluster database-count ceiling on top of the collection-count ceiling)

Limits are sourced from MongoDB's own docs and cited at the top of `scripts/tenant-capacity.js`.

## The three patterns, in one paragraph each

**Shared collection + tenantId.** One collection, every document tagged with `tenantId`, and every compound index built with `tenantId` as the *first* field so tenant-scoped queries stay index-bound instead of degrading into a collection scan as tenant count grows. Isolation is enforced entirely in application code — the query middleware in `order.model.js` throws if a query doesn't include `tenantId`, turning "an engineer forgot to scope a query" into a thrown error instead of a cross-tenant data leak. This is the pattern with the best scaling ceiling and the lowest operational overhead, and it's what I run in production for [LoyaltyOS](https://siloscape.com).

**Database-per-tenant.** Real physical isolation — useful when a customer's compliance requirements demand it, or when "one noisy tenant degrades everyone else's p99" is unacceptable. The cost is connection-pool overhead: naive per-request connections exhaust Atlas's per-node connection limit fast (see `connection-manager.js` for an LRU-capped pool cache that fixes this), and on shared/free tiers you're also capped by the cluster-wide database limit, independent of how much data each tenant actually has.

**Collection-per-tenant.** The pattern people reach for as a middle ground, and the one with the worst ceiling of the three. It gets none of database-per-tenant's real isolation (still one database, one set of role-based access controls) while inheriting the same cluster-wide collection-count ceiling that collections and databases both compete against. Reach for it only if you have a specific reason — otherwise it's strictly dominated by the other two patterns.

## License

MIT
