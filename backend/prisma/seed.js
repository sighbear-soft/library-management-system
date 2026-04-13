const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  // 清空现有数据（避免重复键冲突）
  await prisma.auditLog.deleteMany();
  await prisma.hold.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
  await prisma.announcementPublisher.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.config.deleteMany();

  // 创建用户
  const adminPassword = await bcrypt.hash('admin123', 10);
  const librarianPassword = await bcrypt.hash('lib123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);

  await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@library.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Librarian User',
      email: 'librarian@library.com',
      passwordHash: librarianPassword,
      role: 'LIBRARIAN',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Student One',
      email: 'student1@university.edu',
      passwordHash: studentPassword,
      studentId: 'S12345',
      role: 'STUDENT',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Student Two',
      email: 'student2@university.edu',
      passwordHash: studentPassword,
      studentId: 'S67890',
      role: 'STUDENT',
    },
  });

  // 图书数据
  const booksData = [
    // Technology
    { title: 'The Pragmatic Programmer', author: 'David Thomas', genre: 'Technology', available: true },
    { title: 'Clean Code', author: 'Robert C. Martin', genre: 'Technology', available: true },
    { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', genre: 'Technology', available: true },
    { title: "You Don't Know JS", author: 'Kyle Simpson', genre: 'Technology', available: false },
    // Fiction
    { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', genre: 'Fiction', available: true },
    { title: 'To Kill a Mockingbird', author: 'Harper Lee', genre: 'Fiction', available: true },
    { title: '1984', author: 'George Orwell', genre: 'Fiction', available: true },
    { title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'Fiction', available: false },
    // Science
    { title: 'A Brief History of Time', author: 'Stephen Hawking', genre: 'Science', available: true },
    { title: 'The Selfish Gene', author: 'Richard Dawkins', genre: 'Science', available: true },
    { title: 'Cosmos', author: 'Carl Sagan', genre: 'Science', available: true },
    { title: 'The Double Helix', author: 'James Watson', genre: 'Science', available: false },
    // History
    { title: 'Sapiens', author: 'Yuval Noah Harari', genre: 'History', available: true },
    { title: 'Guns, Germs, and Steel', author: 'Jared Diamond', genre: 'History', available: true },
    { title: 'The Silk Roads', author: 'Peter Frankopan', genre: 'History', available: true },
    { title: "A People's History of the United States", author: 'Howard Zinn', genre: 'History', available: false },
    // Management
    { title: 'The Lean Startup', author: 'Eric Ries', genre: 'Management', available: true },
    { title: 'Good to Great', author: 'Jim Collins', genre: 'Management', available: true },
    { title: 'Drive', author: 'Daniel H. Pink', genre: 'Management', available: true },
    { title: 'The Five Dysfunctions of a Team', author: 'Patrick Lencioni', genre: 'Management', available: false },
  ];

  for (const book of booksData) {
    await prisma.book.create({
      data: {
        title: book.title,
        author: book.author,
        isbn: `ISBN-${Math.random().toString(36).substring(2, 10)}`,
        genre: book.genre,
        description: `${book.title} is a great read.`,
        language: 'English',
        shelfLocation: `${book.genre}-${Math.floor(Math.random() * 100)}`,
        available: book.available,
        totalCopies: 1,
        availableCopies: book.available ? 1 : 0,
      },
    });
  }

  // 添加配置项
  await prisma.config.create({
    data: {
      key: 'FINE_RATE_PER_DAY',
      value: '0.50',
    },
  });

  // 公告数据
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const librarianUser = await prisma.user.findFirst({ where: { role: 'LIBRARIAN' } });

  const announcementsData = [
    {
      title: '图书馆系统升级通知',
      content: '为了提供更好的服务，图书馆管理系统将于本周末进行升级维护。届时系统将暂停服务约2小时，请各位读者提前安排好借阅计划。',
      isPinned: true,
    },
    {
      title: '新增电子资源访问指南',
      content: '图书馆已新增多个电子数据库资源，包括IEEE Xplore、SpringerLink等。读者可通过系统首页的"电子资源"入口访问，凭学号即可免费使用。',
      isPinned: true,
    },
    {
      title: '期末考试期间延长开放时间',
      content: '为配合期末考试复习需求，图书馆将于12月15日至1月5日期间延长开放时间至每晚22:00。祝各位同学考试顺利！',
      isPinned: false,
    },
    {
      title: '新书推荐：计算机科学类',
      content: '本月新到一批计算机科学类图书，涵盖人工智能、数据结构、算法设计等热门领域。欢迎读者前来借阅或在系统中预约。',
      isPinned: false,
    },
    {
      title: '图书馆志愿者招募',
      content: '图书馆现面向全校招募志愿者，协助图书整理、秩序维护等工作。参与志愿服务可获得额外借阅额度，有意者请联系图书馆办公室。',
      isPinned: false,
    },
    {
      title: '关于规范图书归还的提醒',
      content: '近期发现部分读者逾期未归还图书。请广大读者遵守借阅规定，按时归还图书，以免影响其他读者的借阅权益。逾期将按规定收取滞纳金。',
      isPinned: false,
    },
  ];

  for (const [index, announcement] of announcementsData.entries()) {
    const publisher = index % 2 === 0 ? adminUser : librarianUser;
    await prisma.announcement.create({
      data: {
        title: announcement.title,
        content: announcement.content,
        isPinned: announcement.isPinned,
        publishers: {
          create: {
            userId: publisher.id,
          },
        },
      },
    });
  }

  console.log('Seed data inserted successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });