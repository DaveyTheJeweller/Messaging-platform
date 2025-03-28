const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection with SSL enforcement
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { // Critical for Supabase
      require: true,
      rejectUnauthorized: false // Required for self-signed certificates
    }
  },
});

// Question model
const Question = sequelize.define('Question', {
  text: { type: DataTypes.STRING, allowNull: false },
  answer: DataTypes.STRING,
  department: { type: DataTypes.STRING, allowNull: false },
  count: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// Database sync with error handling
sequelize.sync()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database connection failed:', err));

// Socket.IO setup with CORS restrictions
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Your Replit/Vercel URL
    methods: ['GET', 'POST']
  }
});

// Real-time communication handler
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('send_message', async (data) => {
    try {
      const { text, department } = data;
      const [question] = await Question.findOrCreate({
        where: { text, department },
        defaults: { count: 1 }
      });

      if (question.count >= 2) {
        io.emit('receive_message', { 
          text, 
          answer: question.answer || "Our team will respond shortly" 
        });
      } else {
        await question.increment('count');
      }
    } catch (err) {
      console.error('⚠️ Message handling error:', err);
      socket.emit('error', 'Failed to process message');
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

// Server start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
