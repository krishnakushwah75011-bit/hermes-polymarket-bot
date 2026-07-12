// lib/db/client.ts
// PostgreSQL database client using node-pg (replaces Prisma)

import { pool, directPool, query, queryDirect, transaction, initializeDatabase, closePools } from './pool';

export { pool, directPool, query, queryDirect, transaction, initializeDatabase, closePools };

// Re-export types for compatibility
export type { PoolClient } from 'pg';

// For backward compatibility with code expecting Prisma-like interface
export interface DatabaseClient {
  query: typeof import('./pool').query;
  queryDirect: typeof import('./pool').queryDirect;
  transaction: typeof import('./pool').transaction;
}

// Create a Prisma-like interface using pg
export const db = {
  // Wallet profiles
  walletProfile: {
    async findUnique(where: { address: string }) {
      const result = await query('SELECT * FROM "WalletProfile" WHERE address = $1', [where.address.toLowerCase()]);
      return result.rows[0] || null;
    },
    async findMany(options: { where?: any; orderBy?: any; select?: any; take?: number; skip?: number } = {}) {
      let sql = 'SELECT * FROM "WalletProfile"';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (options.where) {
        const conditions: string[] = [];
        for (const [key, value] of Object.entries(options.where)) {
          if (key === 'status' && Array.isArray(value)) {
            conditions.push(`"status" IN (${value.map((_, i) => `$${paramIndex + i}`).join(',')})`);
            params.push(...value);
            paramIndex += value.length;
          } else {
            conditions.push(`"${key}" = $${paramIndex}`);
            params.push(value);
            paramIndex++;
          }
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      if (options.orderBy) {
        const [field, direction] = Object.entries(options.orderBy)[0];
        sql += ` ORDER BY "${field}" ${(direction as string).toUpperCase()}`;
      }
      
      if (options.take) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(options.take);
        paramIndex++;
      }
      
      if (options.skip) {
        sql += ` OFFSET $${paramIndex}`;
        params.push(options.skip);
      }
      
      const result = await query(sql, params);
      return result.rows;
    },
    async upsert(options: { where: { address: string }; create: any; update: any }) {
      const { where, create, update } = options;
      const address = where.address.toLowerCase();
      
      const existing = await this.findUnique({ address });
      if (existing) {
        const fields = Object.keys(update).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
        const values = Object.values(update);
        const result = await query(
          `UPDATE "WalletProfile" SET ${fields}, "updatedAt" = NOW() WHERE address = $1 RETURNING *`,
          [address, ...values]
        );
        return result.rows[0];
      } else {
        const fields = Object.keys(create).map((k, i) => `$${i + 2}`).join(', ');
        const columns = Object.keys(create).map(k => `"${k}"`).join(', ');
        const values = Object.values(create);
        const result = await query(
          `INSERT INTO "WalletProfile" (address, ${columns}) VALUES ($1, ${fields}) RETURNING *`,
          [address, ...values]
        );
        return result.rows[0];
      }
    },
    async update(options: { where: { address: string }; data: any }) {
      const { where, data } = options;
      const address = where.address.toLowerCase();
      const fields = Object.keys(data).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const values = Object.values(data);
      const result = await query(
        `UPDATE "WalletProfile" SET ${fields}, "updatedAt" = NOW() WHERE address = $1 RETURNING *`,
        [address, ...values]
      );
      return result.rows[0];
    },
    async groupBy(options: { by: string[]; where?: any; _count?: { address: boolean } }) {
      const { by, where, _count } = options;
      let sql = `SELECT ${by.map(b => `"${b}"`).join(', ')}`;
      if (_count?.address) sql += ', COUNT(*) as "_count_address"';
      sql += ' FROM "WalletProfile"';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (where) {
        const conditions: string[] = [];
        for (const [key, value] of Object.entries(where)) {
          if (Array.isArray(value)) {
            conditions.push(`"${key}" IN (${value.map((_, i) => `$${paramIndex + i}`).join(',')})`);
            params.push(...value);
            paramIndex += value.length;
          } else {
            conditions.push(`"${key}" = $${paramIndex}`);
            params.push(value);
            paramIndex++;
          }
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      sql += ` GROUP BY ${by.map(b => `"${b}"`).join(', ')}`;
      
      const result = await query(sql, params);
      return result.rows.map(r => ({
        ...r,
        _count: _count?.address ? { address: parseInt(r._count_address) } : undefined,
      }));
    },
  },
  
  // Leaderboard scans
  leaderboardScan: {
    async create(data: { data: { source: string; walletCount: number; lookbackDays: number; rawSummaryJson: string } }) {
      const { source, walletCount, lookbackDays, rawSummaryJson } = data.data;
      const result = await query(
        `INSERT INTO "LeaderboardScan" (source, "walletCount", "lookbackDays", "rawSummaryJson") VALUES ($1, $2, $3, $4) RETURNING *`,
        [source, walletCount, lookbackDays, rawSummaryJson]
      );
      return result.rows[0];
    },
  },
  
  // Historical trades
  historicalTrade: {
    async upsert(options: { where: { transactionHash: string }; create: any; update?: any }) {
      const { where, create, update } = options;
      const fields = Object.keys(create).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const columns = Object.keys(create).map(k => `"${k}"`).join(', ');
      const values = Object.values(create);
      const placeholders = values.map((_, i) => `$${i + 2}`).join(', ');
      
      if (update) {
        const updateFields = Object.keys(update).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
        const updateValues = Object.values(update);
        const result = await query(
          `INSERT INTO "HistoricalTrade" (${columns}) VALUES ($1, ${placeholders}) ON CONFLICT ("transactionHash") DO UPDATE SET ${updateFields} RETURNING *`,
          [where.transactionHash, ...values, ...updateValues]
        );
        return result.rows[0];
      } else {
        const result = await query(
          `INSERT INTO "HistoricalTrade" (${columns}) VALUES ($1, ${placeholders}) ON CONFLICT ("transactionHash") DO NOTHING RETURNING *`,
          [where.transactionHash, ...values]
        );
        return result.rows[0];
      }
    },
    async findMany(options: { where?: any; orderBy?: any; take?: number } = {}) {
      let sql = 'SELECT * FROM "HistoricalTrade"';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (options.where) {
        const conditions: string[] = [];
        for (const [key, value] of Object.entries(options.where)) {
          if (value && typeof value === 'object' && 'gte' in value) {
            conditions.push(`"${key}" >= $${paramIndex}`);
            params.push(value.gte);
            paramIndex++;
          } else if (value && typeof value === 'object' && 'lte' in value) {
            conditions.push(`"${key}" <= $${paramIndex}`);
            params.push(value.lte);
            paramIndex++;
          } else {
            conditions.push(`"${key}" = $${paramIndex}`);
            params.push(value);
            paramIndex++;
          }
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      if (options.orderBy) {
        const [field, direction] = Object.entries(options.orderBy)[0];
        sql += ` ORDER BY "${field}" ${(direction as string).toUpperCase()}`;
      }
      
      if (options.take) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(options.take);
      }
      
      const result = await query(sql, params);
      return result.rows;
    },
    async findUnique(where: { transactionHash: string }) {
      const result = await query('SELECT * FROM "HistoricalTrade" WHERE "transactionHash" = $1', [where.transactionHash]);
      return result.rows[0] || null;
    },
    async count(options: { where: any }) {
      const params: any[] = [];
      let sql = 'SELECT COUNT(*) FROM "HistoricalTrade"';
      let paramIndex = 1;
      
      if (options.where) {
        const conditions: string[] = [];
        for (const [key, value] of Object.entries(options.where)) {
          if (value && typeof value === 'object' && 'gte' in value) {
            conditions.push(`"${key}" >= $${paramIndex}`);
            params.push(value.gte);
            paramIndex++;
          } else if (value && typeof value === 'object' && 'lte' in value) {
            conditions.push(`"${key}" <= $${paramIndex}`);
            params.push(value.lte);
            paramIndex++;
          } else {
            conditions.push(`"${key}" = $${paramIndex}`);
            params.push(value);
            paramIndex++;
          }
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      const result = await query(sql, params);
      return parseInt(result.rows[0].count);
    },
  },
  
  // Market metadata
  marketMetadata: {
    async upsert(options: { where: { conditionId: string }; create: any; update: any }) {
      const { where, create, update } = options;
      const fields = Object.keys(create).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const columns = Object.keys(create).map(k => `"${k}"`).join(', ');
      const values = Object.values(create);
      const placeholders = values.map((_, i) => `$${i + 2}`).join(', ');
      const updateFields = Object.keys(update).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const updateValues = Object.values(update);
      
      const result = await query(
        `INSERT INTO "MarketMetadata" (${columns}) VALUES ($1, ${placeholders}) ON CONFLICT ("conditionId") DO UPDATE SET ${updateFields} RETURNING *`,
        [where.conditionId, ...values, ...updateValues]
      );
      return result.rows[0];
    },
    async findMany(options: { where?: any; take?: number } = {}) {
      let sql = 'SELECT * FROM "MarketMetadata"';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (options.where) {
        const conditions: string[] = [];
        for (const [key, value] of Object.entries(options.where)) {
          if (value && typeof value === 'object') {
            if ('lt' in value) {
              conditions.push(`"${key}" < $${paramIndex}`);
              params.push(value.lt);
            } else if ('not' in value) {
              conditions.push(`"${key}" IS NOT NULL`);
            }
            paramIndex++;
          } else {
            conditions.push(`"${key}" = $${paramIndex}`);
            params.push(value);
            paramIndex++;
          }
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      if (options.take) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(options.take);
      }
      
      const result = await query(sql, params);
      return result.rows;
    },
    async findUnique(where: { conditionId: string }) {
      const result = await query('SELECT * FROM "MarketMetadata" WHERE "conditionId" = $1', [where.conditionId]);
      return result.rows[0] || null;
    },
  },
  
  // Data collection state
  dataCollectionState: {
    async upsert(options: { where: { collectionType: string }; create: any; update: any }) {
      const { where, create, update } = options;
      const fields = Object.keys(create).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const columns = Object.keys(create).map(k => `"${k}"`).join(', ');
      const values = Object.values(create);
      const placeholders = values.map((_, i) => `$${i + 2}`).join(', ');
      const updateFields = Object.keys(update).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const updateValues = Object.values(update);
      
      const result = await query(
        `INSERT INTO "DataCollectionState" (${columns}) VALUES ($1, ${placeholders}) ON CONFLICT ("collectionType") DO UPDATE SET ${updateFields} RETURNING *`,
        [where.collectionType, ...values, ...updateValues]
      );
      return result.rows[0];
    },
    async findUnique(where: { collectionType: string }) {
      const result = await query('SELECT * FROM "DataCollectionState" WHERE "collectionType" = $1', [where.collectionType]);
      return result.rows[0] || null;
    },
  },
  
  // Observed trades
  observedTrade: {
    async upsert(options: { where: { id: string }; create: any; update?: any }) {
      const { where, create, update } = options;
      const fields = Object.keys(create).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const columns = Object.keys(create).map(k => `"${k}"`).join(', ');
      const values = Object.values(create);
      const placeholders = values.map((_, i) => `$${i + 2}`).join(', ');
      
      if (update) {
        const updateFields = Object.keys(update).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
        const updateValues = Object.values(update);
        const result = await query(
          `INSERT INTO "ObservedTrade" (${columns}) VALUES ($1, ${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateFields} RETURNING *`,
          [where.id, ...values, ...updateValues]
        );
        return result.rows[0];
      } else {
        const result = await query(
          `INSERT INTO "ObservedTrade" (${columns}) VALUES ($1, ${placeholders}) ON CONFLICT (id) DO NOTHING RETURNING *`,
          [where.id, ...values]
        );
        return result.rows[0];
      }
    },
  },
  
  // Market snapshots
  marketSnapshot: {
    async create(data: { data: any }) {
      const d = data.data;
      const columns = Object.keys(d).map(k => `"${k}"`).join(', ');
      const values = Object.values(d);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `INSERT INTO "MarketSnapshot" (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    },
  },
  
  // Decision journal
  decisionJournal: {
    async create(data: { data: any }) {
      const d = data.data;
      const columns = Object.keys(d).map(k => `"${k}"`).join(', ');
      const values = Object.values(d);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `INSERT INTO "DecisionJournal" (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    },
    async findUnique(where: { observedTradeId: string }) {
      const result = await query('SELECT * FROM "DecisionJournal" WHERE "observedTradeId" = $1', [where.observedTradeId]);
      return result.rows[0] || null;
    },
  },
  
  // Paper trades
  paperTrade: {
    async create(data: { data: any }) {
      const d = data.data;
      const columns = Object.keys(d).map(k => `"${k}"`).join(', ');
      const values = Object.values(d);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `INSERT INTO "PaperTrade" (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    },
    async findMany(options: { where?: any; orderBy?: any } = {}) {
      let sql = 'SELECT * FROM "PaperTrade"';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (options.where) {
        const conditions: string[] = [];
        for (const [key, value] of Object.entries(options.where)) {
          conditions.push(`"${key}" = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      if (options.orderBy) {
        const [field, direction] = Object.entries(options.orderBy)[0];
        sql += ` ORDER BY "${field}" ${(direction as string).toUpperCase()}`;
      }
      
      const result = await query(sql, params);
      return result.rows;
    },
    async update(options: { where: { id: string }; data: any }) {
      const { where, data } = options;
      const fields = Object.keys(data).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const values = Object.values(data);
      const result = await query(
        `UPDATE "PaperTrade" SET ${fields} WHERE id = $1 RETURNING *`,
        [where.id, ...values]
      );
      return result.rows[0];
    },
  },
  
  // Outcome reviews
  outcomeReview: {
    async create(data: { data: any }) {
      const d = data.data;
      const columns = Object.keys(d).map(k => `"${k}"`).join(', ');
      const values = Object.values(d);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `INSERT INTO "OutcomeReview" (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    },
  },
  
  // Rule sets
  ruleSet: {
    async findFirst(options: { where: { active: boolean }; orderBy: { version: 'desc' } }) {
      const result = await query('SELECT * FROM "RuleSet" WHERE active = true ORDER BY version DESC LIMIT 1');
      return result.rows[0] || null;
    },
    async create(data: { data: any }) {
      const d = data.data;
      const columns = Object.keys(d).map(k => `"${k}"`).join(', ');
      const values = Object.values(d);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `INSERT INTO "RuleSet" (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    },
  },
  
  // Rule changes
  ruleChange: {
    async create(data: { data: any }) {
      const d = data.data;
      const columns = Object.keys(d).map(k => `"${k}"`).join(', ');
      const values = Object.values(d);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `INSERT INTO "RuleChange" (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    },
  },
  
  // Daily reports
  dailyReport: {
    async findUnique(where: { date: Date }) {
      const result = await query('SELECT * FROM "DailyReport" WHERE date = $1', [where.date]);
      return result.rows[0] || null;
    },
    async create(data: { data: any }) {
      const d = data.data;
      const columns = Object.keys(d).map(k => `"${k}"`).join(', ');
      const values = Object.values(d);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `INSERT INTO "DailyReport" (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    },
  },
  
  // Generic query for complex operations
  async $queryRaw(sql: string, ...params: any[]) {
    const result = await query(sql, params);
    return result.rows;
  },
  
  async $executeRaw(sql: string, ...params: any[]) {
    const result = await query(sql, params);
    return result.rowCount;
  },
};

// Export as default for easy migration
export default db;

// Backward compatibility: scripts using import { prisma } will get the db object
export const prisma = db;
