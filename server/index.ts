import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { memoryStore } from './store.js';
import { ClientToServerEvents, ServerToClientEvents } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// REST API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Check room existence and status
app.get('/api/rooms/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = memoryStore.getRoom(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  return res.json({ room });
});

// Download CSV Export
app.get('/api/rooms/:code/export/csv', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = memoryStore.getRoom(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const csv = memoryStore.generateCSV(code);
  const safeTopic = room.topic.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const filename = `${safeTopic}_${code}_QnA.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});

// Download Markdown Export
app.get('/api/rooms/:code/export/md', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = memoryStore.getRoom(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const md = memoryStore.generateMarkdown(code);
  const safeTopic = room.topic.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const filename = `${safeTopic}_${code}_Summary.md`;

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(md);
});

// Socket.IO Real-Time Handlers
io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  // 1. Create Room (Instructor)
  socket.on('create-room', ({ topic }, callback) => {
    try {
      const room = memoryStore.createRoom(topic);
      callback({ success: true, room });
    } catch (err) {
      console.error('Error creating room:', err);
      callback({ success: false, error: 'Failed to create room' });
    }
  });

  // 2. Join Room (Student or Host)
  socket.on('join-room', ({ roomCode, sessionId, role }, callback) => {
    const code = roomCode.toUpperCase();
    const joined = memoryStore.joinSocket(socket.id, code, sessionId, role);

    if (!joined) {
      return callback({ success: false, error: 'Room not found or session ended' });
    }

    socket.join(code);

    // Broadcast updated participant count to the room
    io.to(code).emit('participant-count', joined.room.participantCount);

    callback({
      success: true,
      room: joined.room,
      questions: joined.questions,
      isHost: role === 'host',
    });
  });

  // 3. Submit Question (Student)
  socket.on('submit-question', ({ roomCode, text, slideTag, sessionId }, callback) => {
    const code = roomCode.toUpperCase();
    const question = memoryStore.addQuestion(code, text, slideTag, sessionId);

    if (!question) {
      return callback({ success: false, error: 'Failed to submit question or room is locked' });
    }

    // Broadcast new question to all clients in the room
    io.to(code).emit('question-added', question);
    callback({ success: true, question });
  });

  // 4. Upvote Question
  socket.on('upvote-question', ({ roomCode, questionId, sessionId }, callback) => {
    const code = roomCode.toUpperCase();
    const result = memoryStore.upvoteQuestion(code, questionId, sessionId);

    if (!result) {
      return callback({ success: false, error: 'Question not found' });
    }

    // Broadcast updated question to room
    io.to(code).emit('question-updated', result.question);
    callback({ success: true, upvotes: result.question.upvotes });
  });

  // 5. Toggle Pin Question (Instructor)
  socket.on('toggle-pin-question', ({ roomCode, questionId }, callback) => {
    const code = roomCode.toUpperCase();
    const pinned = memoryStore.togglePinQuestion(code, questionId);

    if (!pinned) {
      return callback({ success: false, error: 'Question not found' });
    }

    io.to(code).emit('question-updated', pinned);
    callback({ success: true, isPinned: pinned.isPinned });
  });

  // 6. Update Question Status (Instructor: Pending -> Answering -> Resolved)
  socket.on('update-question-status', ({ roomCode, questionId, status }, callback) => {
    const code = roomCode.toUpperCase();
    const result = memoryStore.updateQuestionStatus(code, questionId, status);

    if (!result) {
      return callback({ success: false, error: 'Failed to update question status' });
    }

    // If another question was demoted from answering to pending, broadcast that update too
    if (result.previousAnswering) {
      io.to(code).emit('question-updated', result.previousAnswering);
    }

    io.to(code).emit('question-updated', result.updatedQuestion);
    callback({ success: true });
  });

  // 7. Delete Question (Instructor or moderation)
  socket.on('delete-question', ({ roomCode, questionId }, callback) => {
    const code = roomCode.toUpperCase();
    const deleted = memoryStore.deleteQuestion(code, questionId);

    if (!deleted) {
      return callback({ success: false, error: 'Failed to delete question' });
    }

    io.to(code).emit('question-deleted', { questionId });
    callback({ success: true });
  });

  // 8. End Session (Instructor)
  socket.on('end-session', ({ roomCode }, callback) => {
    const code = roomCode.toUpperCase();
    const exportData = memoryStore.endSession(code);

    if (!exportData) {
      return callback({ success: false, error: 'Failed to end session' });
    }

    // Broadcast session-ended event to everyone in the room
    io.to(code).emit('session-ended', { roomCode: code, exportData });
    callback({ success: true, exportData });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const left = memoryStore.leaveSocket(socket.id);
    if (left) {
      io.to(left.roomCode).emit('participant-count', left.participantCount);
    }
  });
});

// Resolve client dist path reliably
const possibleClientPaths = [
  path.resolve(process.cwd(), 'dist/client'),
  path.resolve(__dirname, '../../client'),
  path.resolve(__dirname, '../client'),
];
const clientDistPath = possibleClientPaths.find((p) => fs.existsSync(p)) || path.resolve(process.cwd(), 'dist/client');

app.use(express.static(clientDistPath));

app.get('*', (_req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('PulseQ Backend API is running. Client assets building.');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 PulseQ Server is running on http://localhost:${PORT}`);
});
