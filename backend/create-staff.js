const prisma = require('./src/lib/prisma');
const bcrypt = require('bcrypt');

async function createStaff() {
  try {
    // 创建一个图书馆管理员用户
    const librarian = await prisma.user.create({
      data: {
        name: 'John Librarian',
        email: 'librarian@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'LIBRARIAN'
      }
    });

    console.log('Created librarian:', librarian);

    // 创建一个管理员用户
    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'ADMIN'
      }
    });

    console.log('Created admin:', admin);

    console.log('Staff members created successfully!');
  } catch (error) {
    console.error('Error creating staff members:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createStaff();