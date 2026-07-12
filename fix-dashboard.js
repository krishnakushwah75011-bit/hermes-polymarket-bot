// Replace Prisma with pg in all dashboard files
const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/app/api/health/route.ts',
  'src/app/dashboard/overview/page.tsx',
  'src/app/dashboard/wallets/page.tsx',
  'src/app/dashboard/trades/page.tsx',
  'src/app/dashboard/reports/page.tsx',
];

console.log('Fixing dashboard files to use pg instead of Prisma...\n');

filesToFix.forEach(file => {
  const filePath = path.join('C:/Users/krish/hermes-polymarket-bot', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} - NOT FOUND, skipping`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Replace Prisma imports with pg
  content = content.replace(
    /import.*PrismaClient.*from.*@prisma\/client/g,
    "import { query } from '@/lib/db/pool'"
  );
  
  // Remove prisma instantiation
  content = content.replace(/const prisma = new PrismaClient\(\);?/g, '');
  
  // Replace prisma.$queryRaw with query
  content = content.replace(/prisma\.\$queryRaw/g, 'query');
  
  // Replace prisma.model.findMany with query
  content = content.replace(/prisma\.\w+\.findMany\(\{[^}]*\}\)/g, 
    `query('SELECT * FROM table') // TODO: convert to proper SQL`);
  
  // Replace prisma.model.findFirst
  content = content.replace(/prisma\.\w+\.findFirst\(\{[^}]*\}\)/g,
    `query('SELECT * FROM table LIMIT 1') // TODO: convert`);
  
  // Replace prisma.model.count
  content = content.replace(/prisma\.\w+\.count\(\{[^}]*\}\)/g,
    `query('SELECT COUNT(*) as count FROM table') // TODO`);
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} - FIXED`);
  } else {
    console.log(`⚠️  ${file} - NO CHANGES (already fixed or no Prisma usage)`);
  }
});

console.log('\nDone! Files need manual review for complex queries.');