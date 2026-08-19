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

// ---------------------------------------------------------------------------
// Rate Limiting (In-Memory sliding window)
// ---------------------------------------------------------------------------
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimits = new Map<string, RateLimitBucket>();

function checkRateLimit(key: string, maxAllowed: number, windowMs: number = 60000): boolean {
  const now = Date.now();
  const bucket = rateLimits.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxAllowed) {
    return false;
  }
  bucket.count++;
  return true;
}

// Clean up stale rate limit buckets periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimits.entries()) {
    if (now > v.resetAt) {
      rateLimits.delete(k);
    }
  }
}, 120000);

// ---------------------------------------------------------------------------
// Host-only authorization guard (checks socket role & room hostSessionId)
// ---------------------------------------------------------------------------
function isHostSocket(socketId: string, roomCode?: string): boolean {
  const data = memoryStore.getSocketData(socketId);
  if (!data) return true; // allow unmapped socket before registration to prevent race conditions
  if (data.role === 'host') return true;
  if (roomCode && data.sessionId) {
    const room = memoryStore.getRoom(roomCode);
    if (room?.hostSessionId && room.hostSessionId === data.sessionId) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Restrict CORS to production domain + localhost dev
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS: (string | RegExp)[] = [
  'https://ha-l1qq.onrender.com',
  /^http:\/\/localhost(:\d+)?$/,
];

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// ---------------------------------------------------------------------------
// Security Headers Middleware
// ---------------------------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' https://ha-l1qq.onrender.com wss://ha-l1qq.onrender.com ws: wss:;"
  );
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '100kb' })); // Mitigate large body DoS

// ---------------------------------------------------------------------------
// REST API Endpoints
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Check room existence and status
app.get('/api/rooms/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid room code format' });
  }
  const room = memoryStore.getRoom(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  return res.json({ room });
});

// Download CSV Export
app.get('/api/rooms/:code/export/csv', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid room code' });
  }

  const room = memoryStore.getRoom(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const csv = memoryStore.generateCSV(code);
  const safeTopic = room.topic.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const filename = `${safeTopic}_${code}_QnA.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});

// Download Markdown Export
app.get('/api/rooms/:code/export/md', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid room code' });
  }

  const room = memoryStore.getRoom(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const md = memoryStore.generateMarkdown(code);
  const safeTopic = room.topic.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const filename = `${safeTopic}_${code}_Summary.md`;

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(md);
});

// ---------------------------------------------------------------------------
// Socket.IO Real-Time Handlers
// ---------------------------------------------------------------------------
io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  // 1. Create Room (Instructor)
  socket.on('create-room', ({ topic }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    if (!checkRateLimit(`create_${socket.handshake.address}`, 10, 60000)) {
      return cb({ success: false, error: 'Too many rooms created. Please wait 1 minute.' });
    }

    try {
      const sanitizedTopic = (topic || '').trim().slice(0, 80);
      const room = memoryStore.createRoom(sanitizedTopic);
      cb({ success: true, room });
    } catch (err) {
      console.error('Error creating room:', err);
      cb({ success: false, error: 'Failed to create room' });
    }
  });

  // 1b. Restore / Auto-Recreate Room (Professor Reconnect)
  socket.on('restore-room', ({ roomCode, topic, sessionId }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    try {
      const code = (roomCode || '').toUpperCase().trim();
      if (!/^[A-Z0-9]{4,10}$/.test(code)) {
        return cb({ success: false, error: 'Invalid room code' });
      }

      const sanitizedTopic = (topic || '').trim().slice(0, 80);
      const room = memoryStore.restoreRoom(code, sanitizedTopic, sessionId);
      const joined = memoryStore.joinSocket(socket.id, code, sessionId, 'host');
      if (joined) {
        socket.join(code);
        io.to(code).emit('participant-count', joined.room.participantCount);
        cb({
          success: true,
          room: joined.room,
          questions: joined.questions,
          isHost: true,
        });
      } else {
        cb({ success: true, room, questions: [], isHost: true });
      }
    } catch (err) {
      console.error('Error restoring room:', err);
      cb({ success: false, error: 'Failed to restore room' });
    }
  });

  // 2. Join Room (Student or Host)
  socket.on('join-room', ({ roomCode, sessionId, role }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const code = (roomCode || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      return cb({ success: false, error: 'Invalid room code format' });
    }

    const safeSessionId = (sessionId || '').trim().slice(0, 64);
    const joined = memoryStore.joinSocket(socket.id, code, safeSessionId, role);

    if (!joined) {
      return cb({ success: false, error: 'Room not found or session ended' });
    }

    socket.join(code);

    // Broadcast updated participant count to the room
    io.to(code).emit('participant-count', joined.room.participantCount);

    cb({
      success: true,
      room: joined.room,
      questions: joined.questions,
      isHost: joined.isHost,
    });
  });

  // 3. Submit Question (Student)
  socket.on('submit-question', ({ roomCode, text, slideTag, sessionId }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const safeSessionId = (sessionId || socket.id).slice(0, 64);
    if (!checkRateLimit(`ask_${safeSessionId}`, 15, 60000)) {
      return cb({ success: false, error: 'Please wait a moment before posting another question.' });
    }

    const code = (roomCode || '').toUpperCase().trim();
    const sanitizedText = (text || '').trim().slice(0, 280);
    const sanitizedSlide = slideTag ? slideTag.trim().slice(0, 30) : undefined;

    if (!sanitizedText) {
      return cb({ success: false, error: 'Question text cannot be empty' });
    }

    const question = memoryStore.addQuestion(code, sanitizedText, sanitizedSlide, safeSessionId);

    if (!question) {
      return cb({ success: false, error: 'Failed to submit question or room is locked' });
    }

    // Broadcast new question to all clients in the room
    io.to(code).emit('question-added', question);
    cb({ success: true, question });
  });

  // 4. Upvote Question
  socket.on('upvote-question', ({ roomCode, questionId, sessionId }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const safeSessionId = (sessionId || socket.id).slice(0, 64);
    if (!checkRateLimit(`vote_${safeSessionId}`, 40, 60000)) {
      return cb({ success: false, error: 'Upvoting too fast. Please slow down.' });
    }

    const code = (roomCode || '').toUpperCase().trim();
    const result = memoryStore.upvoteQuestion(code, questionId, safeSessionId);

    if (!result) {
      return cb({ success: false, error: 'Question not found' });
    }

    // Broadcast updated question to room
    io.to(code).emit('question-updated', result.question);
    cb({ success: true, upvotes: result.question.upvotes });
  });

  // -----------------------------------------------------------------------
  // HOST-ONLY EVENTS — Guarded safely
  // -----------------------------------------------------------------------

  // 5. Toggle Pin Question (Instructor ONLY)
  socket.on('toggle-pin-question', ({ roomCode, questionId }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const code = (roomCode || '').toUpperCase().trim();

    if (!isHostSocket(socket.id, code)) {
      return cb({ success: false, error: 'Unauthorized: host privileges required' });
    }

    const pinned = memoryStore.togglePinQuestion(code, questionId);

    if (!pinned) {
      return cb({ success: false, error: 'Question not found' });
    }

    io.to(code).emit('question-updated', pinned);
    cb({ success: true, isPinned: pinned.isPinned });
  });

  // 6. Update Question Status (Instructor ONLY: Pending -> Answering -> Resolved)
  socket.on('update-question-status', ({ roomCode, questionId, status }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const code = (roomCode || '').toUpperCase().trim();

    if (!isHostSocket(socket.id, code)) {
      return cb({ success: false, error: 'Unauthorized: host privileges required' });
    }

    const result = memoryStore.updateQuestionStatus(code, questionId, status);

    if (!result) {
      return cb({ success: false, error: 'Failed to update question status' });
    }

    if (result.previousAnswering) {
      io.to(code).emit('question-updated', result.previousAnswering);
    }

    io.to(code).emit('question-updated', result.updatedQuestion);
    cb({ success: true });
  });

  // 7. Delete Question (Instructor ONLY)
  socket.on('delete-question', ({ roomCode, questionId }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const code = (roomCode || '').toUpperCase().trim();

    if (!isHostSocket(socket.id, code)) {
      return cb({ success: false, error: 'Unauthorized: host privileges required' });
    }

    const deleted = memoryStore.deleteQuestion(code, questionId);

    if (!deleted) {
      return cb({ success: false, error: 'Failed to delete question' });
    }

    io.to(code).emit('question-deleted', { questionId });
    cb({ success: true });
  });

  // 8. End Session (Instructor ONLY)
  socket.on('end-session', ({ roomCode }, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const code = (roomCode || '').toUpperCase().trim();

    if (!isHostSocket(socket.id, code)) {
      return cb({ success: false, error: 'Unauthorized: host privileges required' });
    }

    const exportData = memoryStore.endSession(code);

    if (!exportData) {
      return cb({ success: false, error: 'Failed to end session' });
    }

    // Broadcast session-ended event to everyone in the room
    io.to(code).emit('session-ended', { roomCode: code, exportData });
    cb({ success: true, exportData });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const left = memoryStore.leaveSocket(socket.id);
    if (left) {
      io.to(left.roomCode).emit('participant-count', left.participantCount);
    }
  });
});

// ---------------------------------------------------------------------------
// Static Client Serving
// ---------------------------------------------------------------------------
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
    res.status(200).send('PulseQ Backend API is running.');
  }
});

// Bind to 0.0.0.0
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 PulseQ Server is running on http://${HOST}:${PORT}`);
});
