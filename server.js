const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true, // Enable SSL for secure connections
      rejectUnauthorized: false, // Bypass SSL certificate validation (for testing only)
    },
  },
});

// Define Question model
const Question = sequelize.define('Question', {
  text: DataTypes.STRING,
  answer: DataTypes.STRING,
  department: DataTypes.STRING,
  count: { type: DataTypes.INTEGER, defaultValue: 0 },
});

// Sync database
sequelize.sync();

// Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // Allow all origins for now
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('send_message', async (data) => {
    const { text, department } = data;
    const question = await Question.findOne({ where: { text, department } });

    if (question) {
      question.count += 1;
      await question.save();
      if (question.count >= 2) {
        io.emit('receive_message', { text, answer: question.answer });
      }
    } else {
      await Question.create({ text, department });
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
