// backend/src/services/expireReservations.js
const prisma = require('../lib/prisma');

/**
 * 扫描并释放过期的预约
 * 将过期的 PENDING 状态预约标记为 EXPIRED，并释放对应的副本库存
 */
async function expireReservations() {
  const now = new Date();
  
  console.log(`[${new Date().toISOString()}] 开始扫描过期预约...`);
  
  try {
    // 查找所有过期的 PENDING 预约
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now }
      },
      include: {
        copy: {
          include: { book: true }
        },
        user: true
      }
    });
    
    if (expiredReservations.length === 0) {
      console.log('没有过期的预约需要处理');
      return { processed: 0, released: 0 };
    }
    
    console.log(`发现 ${expiredReservations.length} 个过期预约，开始处理...`);
    
    let releasedCount = 0;
    
    for (const reservation of expiredReservations) {
      try {
        // 使用事务：更新预约状态 + 释放副本
        await prisma.$transaction(async (tx) => {
          // 更新预约状态为 EXPIRED
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: 'EXPIRED' }
          });
          
          // 释放副本（如果副本状态仍然是 RESERVED）
          const copy = await tx.copy.findUnique({
            where: { id: reservation.copyId }
          });
          
          if (copy.status === 'RESERVED') {
            await tx.copy.update({
              where: { id: reservation.copyId },
              data: { status: 'AVAILABLE' }
            });
          }
        });
        
        releasedCount++;
        console.log(`✅ 已释放预约 #${reservation.id}: 图书 ${reservation.copy.book.title}, 用户 ${reservation.user.email}`);
        
      } catch (error) {
        console.error(`处理预约 #${reservation.id} 失败:`, error.message);
      }
    }
    
    console.log(`处理完成：共处理 ${expiredReservations.length} 个过期预约，成功释放 ${releasedCount} 个副本`);
    
    return { processed: expiredReservations.length, released: releasedCount };
  } catch (error) {
    console.error('扫描过期预约失败:', error);
    throw error;
  }
}

module.exports = { expireReservations };