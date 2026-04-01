require('dotenv').config();

const prisma = require('./lib/prisma');
const app = require('./app');

const port = Number(process.env.PORT) || 3001;

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
