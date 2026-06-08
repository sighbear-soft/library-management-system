const prisma = require('./src/lib/prisma');
const bcrypt = require('bcrypt');

async function createStaffUsers() {
  try {
    // 检查是否已经有staff角色的用户
    const existingStaff = await prisma.user.findMany({
      where: { role: 'STAFF' }
    });

    if (existingStaff.length > 0) {
      console.log('Staff users already exist:', existingStaff);
      return;
    }

    // 创建多个专门负责与读者交流的staff用户
    const staffUsers = [
      {
        name: 'Alice Staff',
        email: 'alice.staff@example.com',
        password: 'password123',
        role: 'STAFF'
      },
      {
        name: 'Bob Staff',
        email: 'bob.staff@example.com',
        password: 'password123',
        role: 'STAFF'
      },
      {
        name: 'Charlie Staff',
        email: 'charlie.staff@example.com',
        password: 'password123',
        role: 'STAFF'
      }
    ];

    for (const staff of staffUsers) {
      const createdStaff = await prisma.user.create({
        data: {
          name: staff.name,
          email: staff.email,
          passwordHash: await bcrypt.hash(staff.password, 10),
          role: staff.role
        }
      });
      console.log('Created staff:', createdStaff);
    }

    console.log('Staff users created successfully!');
  } catch (error) {
    console.error('Error creating staff users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createStaffUsers();