const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const MAX_BORROW_LIMIT = 5;
const MAX_RENEW_COUNT = 2;
const RENEW_DAYS = 14;

// 获取我的借阅列表
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
    res.status(500).json({ message: '获取借阅列表失败' });
  }
});

// 借阅图书
router.post('/borrow/:bookId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = parseInt(req.params.bookId);
    
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) return res.status(404).json({ message: '图书不存在' });
    
    const availableCopies = book.availableCopies ?? (book.available ? 1 : 0);
    if (availableCopies <= 0) {
      return res.status(400).json({ message: '图书已全部借出' });
    }
    
    const currentCount = await prisma.loan.count({
      where: { userId, returnDate: null }
    });
    if (currentCount >= MAX_BORROW_LIMIT) {
      return res.status(400).json({ message: `借阅数量已达上限（最多${MAX_BORROW_LIMIT}本）` });
    }
    
    const existing = await prisma.loan.findFirst({
      where: { userId, bookId, returnDate: null }
    });
    if (existing) {
      return res.status(400).json({ message: '您已借阅过此书，请先归还' });
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
    
    res.status(201).json({ message: '借阅成功', loan });
  } catch (error) {
    res.status(500).json({ message: '借阅失败' });
  }
});

// 续借图书
router.post('/renew', requireAuth, async (req, res) => {
  try {
    const { loanIds } = req.body;
    const userId = req.user.id;
    
    if (!loanIds || loanIds.length === 0) {
      return res.status(400).json({ message: '请选择要续借的图书' });
    }
    
    const results = [];
    for (const loanId of loanIds) {
      const loan = await prisma.loan.findFirst({
        where: { id: loanId, userId, returnDate: null },
        include: { book: true }
      });
      
      if (!loan) {
        results.push({ loanId, success: false, message: '借阅记录不存在' });
        continue;
      }
      
      if (loan.renewCount >= MAX_RENEW_COUNT) {
        results.push({ loanId, success: false, message: `续借次数已达上限（最多${MAX_RENEW_COUNT}次）` });
        continue;
      }
      
      const hasReservation = await prisma.hold.findFirst({
        where: { bookId: loan.bookId, status: 'WAITING' }
      });
      if (hasReservation) {
        results.push({ loanId, success: false, message: '该书已被其他读者预约，不可续借' });
        continue;
      }
      
      const newDueDate = new Date(loan.dueDate);
      newDueDate.setDate(newDueDate.getDate() + RENEW_DAYS);
      
      await prisma.loan.update({
        where: { id: loanId },
        data: { dueDate: newDueDate, renewCount: loan.renewCount + 1 }
      });
      
      results.push({ loanId, success: true, newDueDate, message: '续借成功' });
    }
    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: '续借失败' });
  }
});

module.exports = router;