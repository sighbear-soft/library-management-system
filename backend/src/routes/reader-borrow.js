const express = require('express');
<<<<<<< HEAD
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const {
  getFineRatePerDay,
  decorateLoanWithFine,
  buildReturnSummary,
} = require('../lib/fines');

// 引入支付宝 SDK
const alipaySdk = require('./alipay');
const buildPagePayUrl = alipaySdk.buildPagePayUrl;
const { getAlipayReturnUrl, getAlipayNotifyUrl, getFrontendUrl } = alipaySdk;


const router = express.Router();

const MAX_BORROW_LIMIT = 5;

// 生成借阅条形码 BC-xxxxxx-xxx 格式
function generateLoanBarcode() {
  const part1 = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  const part2 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `BC-${part1}-${part2}`;
}

// 生成唯一的借阅条形码
async function generateUniqueBarcode() {
  let barcode;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    barcode = generateLoanBarcode();
    attempts++;
    const existing = await prisma.loan.findUnique({ where: { barcode } });
    if (!existing) return barcode;
  } while (attempts < maxAttempts);
  
  throw new Error('无法生成唯一的条形码');
}
const MAX_RENEW_COUNT = 2;
const RENEW_DAYS = 14;

async function writeAuditLog(data) {
  try {
    await prisma.auditLog.create({ data });
  } catch (error) {
    console.warn('Failed to write audit log:', error.message);
  }
}

function parseLoanIdFromOutTradeNo(outTradeNo) {
  const underscored = outTradeNo.match(/^FINE_(\d+)_\d+$/);
  if (underscored) return parseInt(underscored[1], 10);

  // 兼容旧格式 FINE{loanId}{13位时间戳}，如 FINE151780239870831
  const compact = outTradeNo.match(/^FINE(\d+?)(\d{13})$/);
  if (compact) return parseInt(compact[1], 10);

  return NaN;
}

async function completeReturnAfterFinePaid(loanId, tx = prisma) {
  const loan = await tx.loan.findFirst({
    where: { id: loanId, returnDate: null },
    include: { copy: { include: { book: true } }, user: true },
  });
  if (!loan) return false;

  const fineRatePerDay = await getFineRatePerDay();
  const returnDate = new Date();
  const returnSummary = buildReturnSummary(loan, returnDate, fineRatePerDay, { waiveFine: false });

  await tx.loan.update({
    where: { id: loanId },
    data: {
      returnDate,
      fineAmount: returnSummary.fineAmount,
      finePaid: returnSummary.fineAmount > 0 ? true : loan.finePaid,
      fineForgiven: returnSummary.fineForgiven,
    },
  });

  await tx.copy.update({
    where: { id: loan.copyId },
    data: { status: 'AVAILABLE' },
  });

  writeAuditLog({
    userId: loan.userId,
    action: 'RETURN_BOOK',
    entity: 'Loan',
    entityId: loanId,
    detail: `读者 ${loan.user.email} 支付罚款后自动还书(借阅记录 ${loanId})，罚款 ¥${returnSummary.fineAmount.toFixed(2)}`,
  });

  return true;
}

async function markFineAsPaid(loanId, amount, source) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { user: true },
  });
  if (!loan) {
    console.error(`markFineAsPaid: 借阅记录 ${loanId} 不存在，请检查订单号解析是否正确`);
    return false;
  }

  const needsReturn = !loan.returnDate;

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loanId },
      data: {
        finePaid: true,
        fineForgiven: false,
      },
    });

    if (needsReturn) {
      const returned = await completeReturnAfterFinePaid(loanId, tx);
      if (!returned) {
        throw new Error(`支付后自动还书失败: 借阅记录 ${loanId}`);
      }
    }
  });

  writeAuditLog({
    userId: loan.userId,
    action: 'FINE_PAYMENT',
    entity: 'Loan',
    entityId: loanId,
    detail: `用户通过支付宝(${source})支付了借阅记录 ${loanId} 的罚款 ¥${amount}`,
  });

  return true;
}

async function ensureReturnAfterFinePaid(loanId) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.returnDate) {
    return Boolean(loan?.returnDate);
  }
  return completeReturnAfterFinePaid(loanId);
}

async function handlePayFine(req, res) {
  try {
    const loanId = parseInt(req.params.loanId);

    let loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        userId: req.user.id,
      },
      include: {
        copy: {
          include: {
            book: true,
          },
        },
      },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: '借阅记录不存在或不属于当前用户',
      });
    }

    if (loan.finePaid) {
      return res.status(400).json({
        success: false,
        message: '罚款已经支付',
      });
    }

    let calculatedFineAmount = Number(loan.fineAmount || 0);
    if (!loan.returnDate) {
      const fineRatePerDay = await getFineRatePerDay();
      const returnDate = new Date();
      const returnSummary = buildReturnSummary(loan, returnDate, fineRatePerDay, { waiveFine: false });
      calculatedFineAmount = returnSummary.fineAmount;

      await prisma.loan.update({
        where: { id: loanId },
        data: {
          fineAmount: calculatedFineAmount,
          finePaid: false,
          fineForgiven: returnSummary.fineForgiven,
        },
      });
    }

    if (!calculatedFineAmount || calculatedFineAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: '该借阅记录没有罚款需要支付',
      });
    }

    loan = { ...loan, fineAmount: calculatedFineAmount };

    const outTradeNo = `FINE_${loanId}_${Date.now()}`;
    const notifyUrl = getAlipayNotifyUrl();
    const returnUrl = getAlipayReturnUrl();

    if (process.env.ALIPAY_MOCK_PAY === 'true') {
      await markFineAsPaid(loanId, loan.fineAmount.toFixed(2), 'mock');
      console.log('⚠️ ALIPAY_MOCK_PAY 已开启，跳过真实支付');
      return res.redirect(`${getFrontendUrl()}/history?fine_paid=1&out_trade_no=${outTradeNo}`);
    }

    const payParams = {
      bizContent: {
        outTradeNo,
        productCode: 'FAST_INSTANT_TRADE_PAY',
        totalAmount: loan.fineAmount.toFixed(2),
        subject: `LibraryFine${loanId}`,
        body: `Loan ${loanId} overdue fine`,
      },
      returnUrl,
    };

    if (notifyUrl) {
      payParams.notifyUrl = notifyUrl;
    } else {
      console.warn('⚠️ ALIPAY_NOTIFY_URL 未配置，将仅依赖支付回跳同步确认');
    }

    console.log('开始生成支付链接...', {
      loanId,
      fineAmount: loan.fineAmount.toFixed(2),
      outTradeNo,
      returnUrl,
      notifyUrl: notifyUrl || '(未配置)',
    });

    const payUrl = buildPagePayUrl('alipay.trade.page.pay', payParams);
    res.redirect(payUrl);
  } catch (error) {
    console.error('支付失败:', error);
    res.status(500).json({
      success: false,
      message: '支付失败，请稍后重试',
    });
  }
}

// ==================== 原有功能（保留） ====================

// 获取我的借阅列表（包括已归还和未归还）
router.get('/my-borrows', requireAuth, async (req, res) => {
  try {
    const fineRatePerDay = await getFineRatePerDay();
    const loans = await prisma.loan.findMany({
      where: { userId: req.user.id },
      include: {
        copy: {
          include: { book: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });
    // 使用罚款计算逻辑装饰借阅记录
    const decoratedLoans = loans.map((loan) => decorateLoanWithFine(loan, fineRatePerDay));
    res.json({ loans: decoratedLoans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取借阅列表失败' });
  }
});

// 获取可借副本列表
router.get('/available-copies/:bookId', requireAuth, async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const copies = await prisma.copy.findMany({
      where: {
        bookId: bookId,
        status: 'AVAILABLE'
      },
      select: {
        id: true,
        barcode: true,
        floor: true,
        libraryArea: true,
        shelfNo: true,
        shelfLevel: true
      }
    });
    res.json({ copies });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取副本列表失败' });
  }
});

// ==================== 修改：借阅改为预约 ====================
// 预约图书（原来的直接借阅改为预约，2小时内到馆确认）
router.post('/borrow/:copyId', requireAuth, async (req, res) => {
  if (req.user.isBlocked) {
    return res.status(403).json({ message: `您的账号已被封禁，无法预约书籍。封禁原因：${req.user.blockReason || '违反图书馆相关规定'}` });
  }

  try {
    const copyId = parseInt(req.params.copyId);

    // 1. 检查副本是否存在且可预约
    const copy = await prisma.copy.findUnique({
      where: { id: copyId },
      include: { book: true }
    });

    if (!copy) {
      return res.status(404).json({ message: '副本不存在' });
    }

    if (copy.status !== 'AVAILABLE') {
      return res.status(400).json({ message: '该副本不可预约（已被借出或损坏）' });
    }

    // 2. 检查用户是否有未完成的预约（防止重复预约同一本书）
    const existingReservation = await prisma.reservation.findFirst({
      where: {
        userId: req.user.id,
        copyId: copyId,
        status: 'PENDING'
      }
    });

    if (existingReservation) {
      return res.status(400).json({ message: '您已预约过这本书，请尽快到图书馆借出' });
    }

    // 3. 检查用户当前借阅数量限制
    const currentBorrowCount = await prisma.loan.count({
      where: { userId: req.user.id, returnDate: null }
    });
    if (currentBorrowCount >= MAX_BORROW_LIMIT) {
      return res.status(400).json({ message: `您当前借阅数量已达上限（${MAX_BORROW_LIMIT}本），请先归还部分图书` });
    }

    // 4. 检查是否已借阅过这本书（未归还）
    const existingLoan = await prisma.loan.findFirst({
      where: {
        userId: req.user.id,
        copy: { bookId: copy.bookId },
        returnDate: null
      }
    });
    if (existingLoan) {
      return res.status(400).json({ message: '您已借阅过这本书，请先归还' });
    }

    // 5. 创建预约记录，并临时锁定副本状态
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2); // 2小时后过期

    // 使用事务：创建预约 + 更新副本状态为 RESERVED
    const reservation = await prisma.$transaction(async (tx) => {
      // 再次确认副本仍然可用（防止并发）
      const currentCopy = await tx.copy.findUnique({
        where: { id: copyId }
      });
      
      if (currentCopy.status !== 'AVAILABLE') {
        throw new Error('该副本已被他人预约或借出');
      }

      // 更新副本状态为预约锁定
      await tx.copy.update({
        where: { id: copyId },
        data: { status: 'RESERVED' }
      });

      // 创建预约记录
      return tx.reservation.create({
        data: {
          copyId: copyId,
          userId: req.user.id,
          expiresAt: expiresAt,
          status: 'PENDING'
        }
      });
    });

    writeAuditLog({
      userId: req.user.id,
      action: 'RESERVE_BOOK',
      entity: 'Reservation',
      entityId: reservation.id,
      detail: `读者 ${req.user.email} 预约了《${copy.book.title}》(副本 ${copyId})，有效期至 ${expiresAt.toISOString()}`,
    });

    res.status(201).json({
      success: true,
      message: `预约成功！请在2小时内到图书馆借出《${copy.book.title}》，否则预约将自动失效。`,
      reservation: {
        id: reservation.id,
        bookTitle: copy.book.title,
        copyBarcode: copy.barcode,
        expiresAt: expiresAt,
        expiresInMinutes: 120
      }
    });
  } catch (error) {
    console.error('预约失败:', error);
    res.status(500).json({ message: error.message || '预约失败' });
  }
});

// ==================== 新增：预约相关接口 ====================

// 获取我的预约列表
router.get('/my-reservations', requireAuth, async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        userId: req.user.id,
        status: { in: ['PENDING', 'EXPIRED', 'CANCELLED'] }
      },
      include: {
        copy: {
          include: { book: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    const formattedReservations = reservations.map(res => ({
      id: res.id,
      bookTitle: res.copy.book.title,
      bookAuthor: res.copy.book.author,
      copyBarcode: res.copy.barcode,
      status: res.status,
      expiresAt: res.expiresAt,
      isExpired: res.status === 'PENDING' && new Date(res.expiresAt) < now,
      createdAt: res.createdAt
    }));

    res.json({ success: true, reservations: formattedReservations });
  } catch (error) {
    console.error('获取预约列表失败:', error);
    res.status(500).json({ success: false, message: '获取预约列表失败' });
  }
});

// 取消预约
router.post('/cancel-reservation/:reservationId', requireAuth, async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId);

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { copy: true, user: true }
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: '预约记录不存在' });
    }

    if (reservation.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: '无权取消此预约' });
    }

    if (reservation.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `预约状态为 ${reservation.status}，无法取消` });
    }

    // 使用事务：更新预约状态 + 释放副本
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'CANCELLED' }
      });

      await tx.copy.update({
        where: { id: reservation.copyId },
        data: { status: 'AVAILABLE' }
      });
    });

    writeAuditLog({
      userId: req.user.id,
      action: 'CANCEL_RESERVATION',
      entity: 'Reservation',
      entityId: reservationId,
      detail: `读者 ${req.user.email} 取消了预约`,
    });

    res.json({ success: true, message: '预约已取消，库存已释放' });
  } catch (error) {
    console.error('取消预约失败:', error);
    res.status(500).json({ success: false, message: '取消预约失败' });
  }
});

// ==================== 原有功能（保留） ====================

// 续借图书 - 使用 copyId
router.post('/renew', requireAuth, async (req, res) => {
  if (req.user.isBlocked) {
    return res.status(403).json({ message: `您的账号已被封禁，无法续借书籍。封禁原因：${req.user.blockReason || '违反图书馆相关规定'}` });
  }

  try {
    const { copyId } = req.body;

    if (!copyId) {
      return res.status(400).json({ message: '请提供副本ID' });
    }

    const loan = await prisma.loan.findFirst({
      where: {
        copyId: parseInt(copyId),
        userId: req.user.id,
        returnDate: null
      }
    });

    if (!loan) {
      return res.status(404).json({ message: '借阅记录不存在' });
    }

    const currentRenewCount = loan.renewCount || 0;
    if (currentRenewCount >= MAX_RENEW_COUNT) {
      return res.status(400).json({ message: `续借次数已达上限（最多${MAX_RENEW_COUNT}次）` });
    }

    const newDueDate = new Date(loan.dueDate);
    newDueDate.setDate(newDueDate.getDate() + RENEW_DAYS);

    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        dueDate: newDueDate,
        renewCount: currentRenewCount + 1
      }
    });

    writeAuditLog({
      userId: req.user.id,
      action: 'RENEW_LOAN',
      entity: 'Loan',
      entityId: loan.id,
      detail: `读者 ${req.user.email} 续借了借阅记录 ${loan.id}，新到期日 ${newDueDate.toISOString().slice(0, 10)}`,
    });

    res.json({
      success: true,
      message: '续借成功',
      newDueDate: newDueDate,
      renewCount: currentRenewCount + 1
    });
  } catch (error) {
    console.error('续借错误:', error);
    res.status(500).json({ message: '续借失败' });
  }
});

// 归还图书
router.post('/return/:loanId', requireAuth, async (req, res) => {
  try {
    const loanId = parseInt(req.params.loanId);

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId: req.user.id },
      include: { copy: { include: { book: true } }, user: true }
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: '借阅记录不存在' });
    }

    if (loan.returnDate) {
      return res.json({
        success: true,
        message: `《${loan.copy.book.title}》已成功归还`,
        alreadyReturned: true,
        loan: {
          id: loan.id,
          bookTitle: loan.copy.book.title,
          returnDate: loan.returnDate,
          fineAmount: Number(loan.fineAmount ?? 0),
          finePaid: Boolean(loan.finePaid),
          fineForgiven: Boolean(loan.fineForgiven),
        }
      });
    }

    // 获取罚款率并计算罚款
    const fineRatePerDay = await getFineRatePerDay();
    const returnDate = new Date();
    const returnSummary = buildReturnSummary(loan, returnDate, fineRatePerDay, { waiveFine: false });

    // 更新借阅记录，设置归还日期和罚款金额
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        returnDate: returnDate,
        fineAmount: returnSummary.fineAmount,
        finePaid: returnSummary.fineAmount > 0 ? Boolean(loan.finePaid) : true,
        fineForgiven: returnSummary.fineForgiven,
      },
      include: {
        copy: { include: { book: true } }
      }
    });

    await prisma.copy.update({
      where: { id: loan.copyId },
      data: { status: 'AVAILABLE' }
    });

    let message = `《${loan.copy.book.title}》已成功归还`;
    if (returnSummary.fineAmount > 0) {
      message += `，逾期罚款 ¥${returnSummary.fineAmount.toFixed(2)}`;
    }

    writeAuditLog({
      userId: req.user.id,
      action: 'RETURN_BOOK',
      entity: 'Loan',
      entityId: loanId,
      detail: `读者 ${req.user.email} 自助还书(借阅记录 ${loanId})，罚款 ¥${returnSummary.fineAmount.toFixed(2)}`,
    });

    res.json({
      success: true,
      message: message,
      loan: {
        id: updatedLoan.id,
        bookTitle: updatedLoan.copy.book.title,
        returnDate: updatedLoan.returnDate,
        fineAmount: Number(updatedLoan.fineAmount ?? 0),
        finePaid: Boolean(updatedLoan.finePaid),
        fineForgiven: Boolean(updatedLoan.fineForgiven),
        isOverdue: returnSummary.isOverdue,
        overdueDays: returnSummary.overdueDays,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '归还失败' });
  }
});

// 支付宝同步回跳（公网 HTTPS，再转发到本地前端）
router.get('/alipay-return', (req, res) => {
  const query = new URLSearchParams(req.query);
  const target = new URL('/history', getFrontendUrl());
  query.forEach((value, key) => target.searchParams.set(key, value));
  res.redirect(target.toString());
});

// 支付回跳后主动查询订单状态（notify 不可用时的兜底，须在 :loanId 之前注册）
router.post('/pay-fine/sync', requireAuth, async (req, res) => {
  try {
    const { outTradeNo } = req.body;

    if (!outTradeNo || !outTradeNo.startsWith('FINE')) {
      return res.status(400).json({ success: false, message: '无效的订单号' });
    }

    const loanId = parseLoanIdFromOutTradeNo(outTradeNo);
    if (!loanId) {
      return res.status(400).json({ success: false, message: '无效的订单号' });
    }

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId: req.user.id },
      include: { copy: { include: { book: true } } },
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: '借阅记录不存在' });
    }

    const bookTitle = loan.copy?.book?.title;

    if (loan.finePaid) {
      const returned = await ensureReturnAfterFinePaid(loanId);
      return res.json({ success: true, paid: true, alreadyPaid: true, returned, bookTitle });
    }

    const result = await alipaySdk.exec('alipay.trade.query', {
      bizContent: { outTradeNo },
    });

    const tradeStatus = result.tradeStatus;
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      await markFineAsPaid(loanId, result.totalAmount || loan.fineAmount, 'sync');
      const returned = await ensureReturnAfterFinePaid(loanId);
      return res.json({ success: true, paid: true, returned, bookTitle });
    }

    return res.json({
      success: false,
      paid: false,
      status: tradeStatus,
      message: '支付尚未完成，请稍后再试',
    });
  } catch (error) {
    console.error('同步支付状态失败:', error);
    res.status(500).json({ success: false, message: '查询支付状态失败' });
  }
});

// 支付罚款（GET 用于浏览器直接跳转，POST 保留兼容）
router.get('/pay-fine/:loanId', requireAuth, handlePayFine);
router.post('/pay-fine/:loanId', requireAuth, handlePayFine);

// 支付宝异步通知接口
router.post('/alipay-notify', async (req, res) => {
  try {
    console.log('\n========== 支付宝异步通知报文 ==========');
    console.log('请求体内容:', JSON.stringify(req.body, null, 2));
    console.log('==========================================\n');

    const verifyResult = alipaySdk.checkNotifySignV2(req.body);

    console.log('签名验证结果:', verifyResult);

    if (!verifyResult) {
      console.error('支付宝签名验证失败');
      return res.status(400).send('sign error');
    }

    const { out_trade_no, trade_status, total_amount } = req.body;

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      const loanId = parseLoanIdFromOutTradeNo(out_trade_no);
      if (!loanId) {
        console.error('无法从订单号解析 loanId:', out_trade_no);
        return res.status(400).send('invalid out_trade_no');
      }
      const ok = await markFineAsPaid(loanId, total_amount, 'notify');
      if (!ok) {
        return res.status(400).send('loan not found');
      }
      console.log(`罚款支付成功: 订单号 ${out_trade_no}, 金额 ¥${total_amount}`);
    }

    res.send('success');
  } catch (error) {
    console.error('支付宝通知处理失败:', error);
    res.status(500).send('error');
=======
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const MAX_BORROW_LIMIT = 5;
const MAX_RENEW_COUNT = 2;
const RENEW_DAYS = 14;

// ��ȡ�ҵĽ����б�
router.get('/my-borrows', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const loans = await prisma.loan.findMany({
      where: { userId, returnDate: null },
      include: { book: true },
      orderBy: { dueDate: 'asc' }
    });
    res.json({ loans });
  } catch (error) {
    res.status(500).json({ message: '��ȡ�����б�ʧ��' });
  }
});

// ����ͼ��
router.post('/borrow/:bookId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = parseInt(req.params.bookId);
    
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) return res.status(404).json({ message: 'ͼ�鲻����' });
    
    const availableCopies = book.availableCopies ?? (book.available ? 1 : 0);
    if (availableCopies <= 0) {
      return res.status(400).json({ message: 'ͼ����ȫ�����' });
    }
    
    const currentCount = await prisma.loan.count({
      where: { userId, returnDate: null }
    });
    if (currentCount >= MAX_BORROW_LIMIT) {
      return res.status(400).json({ message: `���������Ѵ����ޣ����${MAX_BORROW_LIMIT}����` });
    }
    
    const existing = await prisma.loan.findFirst({
      where: { userId, bookId, returnDate: null }
    });
    if (existing) {
      return res.status(400).json({ message: '���ѽ��Ĺ����飬���ȹ黹' });
    }
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    
    const loan = await prisma.loan.create({
      data: { userId, bookId, dueDate, fineAmount: 0, finePaid: false, fineForgiven: false, renewCount: 0 },
      include: { book: true }
    });
    
    await prisma.book.update({
      where: { id: bookId },
      data: { availableCopies: { decrement: 1 } }
    });
    
    res.status(201).json({ message: '���ĳɹ�', loan });
  } catch (error) {
    res.status(500).json({ message: '����ʧ��' });
  }
});

// ����ͼ��
router.post('/renew', requireAuth, async (req, res) => {
  try {
    const { loanIds } = req.body;
    const userId = req.user.id;
    
    if (!loanIds || loanIds.length === 0) {
      return res.status(400).json({ message: '��ѡ��Ҫ�����ͼ��' });
    }
    
    const results = [];
    for (const loanId of loanIds) {
      const loan = await prisma.loan.findFirst({
        where: { id: loanId, userId, returnDate: null },
        include: { book: true }
      });
      
      if (!loan) {
        results.push({ loanId, success: false, message: '���ļ�¼������' });
        continue;
      }
      
      if (loan.renewCount >= MAX_RENEW_COUNT) {
        results.push({ loanId, success: false, message: `��������Ѵ����ޣ����${MAX_RENEW_COUNT}�Σ�` });
        continue;
      }
      
      const hasReservation = await prisma.hold.findFirst({
        where: { bookId: loan.bookId, status: 'WAITING' }
      });
      if (hasReservation) {
        results.push({ loanId, success: false, message: '�����ѱ���������ԤԼ����������' });
        continue;
      }
      
      const newDueDate = new Date(loan.dueDate);
      newDueDate.setDate(newDueDate.getDate() + RENEW_DAYS);
      
      await prisma.loan.update({
        where: { id: loanId },
        data: { dueDate: newDueDate, renewCount: loan.renewCount + 1 }
      });
      
      results.push({ loanId, success: true, newDueDate, message: '����ɹ�' });
    }
    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: '����ʧ��' });
>>>>>>> af9ecfbeebfa89b807d4957f9b88257908c13b6b
  }
});

module.exports = router;