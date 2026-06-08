const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function test() { 
  const now = new Date(); 
  console.log('当前时间:', now); 
  const announcements = await prisma.announcement.findMany({ 
    where: { publishDate: { lte: now } } 
  }); 
  console.log('查询结果:', announcements.length); 
  console.log('数据:', announcements); 
} 
test().finally(() =
