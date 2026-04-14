require('dotenv').config();

const prisma = require('./lib/prisma');
const express = require('express');
const cors = require('cors');

const booksRouter = require('./routes/books');
const logsRouter = require('./routes/logs');
const authRouter = require('./routes/auth');

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: "ok", message: "Library API is running" });
});

app.use('/api/librarian/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/logs', logsRouter);
app.use('/books', booksRouter);
app.use('/logs', logsRouter);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(error?.statusCode || 500).json({
    message: error?.message || 'Internal server error',
  });
});

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
