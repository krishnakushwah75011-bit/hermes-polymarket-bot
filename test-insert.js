const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_43lLrWXnDJCS@ep-polished-bird-atbg8rjy-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true',
  ssl: { rejectUnauthorized: false },
});

async function test() {
  const client = await pool.connect();
  try {
    // Simple UPDATE since address already exists
    const result = await client.query(`
      UPDATE "WalletProfile" SET
        label = $1,
        "sourceRank" = $2,
        status = $3,
        "roi30d" = $4,
        "consistencyScore" = $5,
        "copyabilityScore" = $6,
        "oneHitWonderPenalty" = $7,
        "globalScore" = $8,
        "bestCategory" = $9,
        "categoryStrengthsJson" = $10,
        "averageTradeSize" = $11,
        "tradeCount30d" = $12,
        "resolvedTradeCount30d" = $13,
        "winRate30d" = $14,
        "averageLiquidity" = $15,
        "averageSpread" = $16,
        "averageEntryTiming" = $17,
        "copyabilityNotes" = $18,
        "riskNotes" = $19,
        "statusReason" = $20,
        "lastScannedAt" = $21,
        "updatedAt" = NOW()
      WHERE address = $22
      RETURNING id
    `, [
      'test',  // label
      1,  // sourceRank
      'IGNORE',  // status
      0.0,  // roi30d
      0.0,  // consistencyScore
      0.0,  // copyabilityScore
      0.0,  // oneHitWonderPenalty
      0.0,  // globalScore
      null,  // bestCategory
      '{}',  // categoryStrengthsJson
      0.0,  // averageTradeSize
      0,  // tradeCount30d
      0,  // resolvedTradeCount30d
      0.0,  // winRate30d
      0.0,  // averageLiquidity
      0.0,  // averageSpread
      0.0,  // averageEntryTiming
      'test',  // copyabilityNotes
      'test',  // riskNotes
      'test',  // statusReason
      new Date(),  // lastScannedAt
      '0xb60761495749a5f7683ad338f67308d4f68e28b9',  // address
    ]);
    console.log('Success:', result.rows[0]);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
test().catch(console.error);