
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma/client.ts';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

try {
  await prisma.$connect();
  console.log('Prisma connected.');

  const result = await prisma.$queryRaw`SELECT 1 AS test`;
  console.log('Query succeeded:', result);
} catch (error) {
  console.error('Prisma test failed:', error);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
