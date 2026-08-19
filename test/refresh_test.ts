import { io } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { MemoryStore } from '../server/store.js';

const app = express();
const server = http.createServer(app);
const store = new MemoryStore();

const ioServer = new Server(server, {
  cors: { origin: '*' }
});

ioServer.on('connection', (socket) => {
  socket.on('create-room', ({ topic }, cb) => {
    const room = store.createRoom(topic);
    cb({ success: true, room });
  });

  socket.on('join-room', ({ roomCode, sessionId, role }, cb) => {
    const joined = store.joinSocket(socket.id, roomCode, sessionId, role);
    if (!joined) {
      return cb({ success: false, error: 'Room not found' });
    }
    socket.join(roomCode.toUpperCase());
    cb({
      success: true,
      room: joined.room,
      questions: joined.questions,
      isHost: joined.isHost,
    });
  });

  socket.on('submit-question', ({ roomCode, text, slideTag, sessionId }, cb) => {
    const q = store.addQuestion(roomCode, text, slideTag, sessionId);
    cb({ success: !!q, question: q });
  });
});

server.listen(4444, '127.0.0.1', async () => {
  console.log('Test server started on 4444');

  const hostSessionId = 'prof_session_123';
  const studentSessionId = 'student_session_456';

  // 1. Host creates room
  const hostSocket1 = io('http://127.0.0.1:4444');
  let roomCode = '';

  await new Promise<void>((resolve) => {
    hostSocket1.on('connect', () => {
      hostSocket1.emit('create-room', { topic: 'CS 101 Lecture' }, (res: any) => {
        roomCode = res.room.code;
        hostSocket1.emit('join-room', { roomCode, sessionId: hostSessionId, role: 'host' }, (joinRes: any) => {
          console.log('Host 1 joined:', joinRes.success, 'isHost:', joinRes.isHost);
          resolve();
        });
      });
    });
  });

  // 2. Student joins & asks a question
  const studentSocket1 = io('http://127.0.0.1:4444');
  await new Promise<void>((resolve) => {
    studentSocket1.on('connect', () => {
      studentSocket1.emit('join-room', { roomCode, sessionId: studentSessionId, role: 'student' }, (joinRes: any) => {
        console.log('Student 1 joined:', joinRes.success, 'isHost:', joinRes.isHost);
        studentSocket1.emit('submit-question', { roomCode, text: 'Can you explain step 2?', sessionId: studentSessionId }, (qRes: any) => {
          console.log('Student submitted doubt:', qRes.question.text);
          resolve();
        });
      });
    });
  });

  // 3. SIMULATE REFRESH: Disconnect sockets
  hostSocket1.disconnect();
  studentSocket1.disconnect();

  console.log('\n--- SIMULATING BROWSER REFRESH ---');

  // 4. Host opens page again (new socket, same sessionId, same room)
  const hostSocket2 = io('http://127.0.0.1:4444');
  await new Promise<void>((resolve) => {
    hostSocket2.on('connect', () => {
      hostSocket2.emit('join-room', { roomCode, sessionId: hostSessionId, role: 'host' }, (res: any) => {
        console.log('Host reconnected after refresh:');
        console.log('  Success:', res.success);
        console.log('  IsHost:', res.isHost);
        console.log('  Questions count:', res.questions?.length);
        console.log('  Question text:', res.questions?.[0]?.text);
        resolve();
      });
    });
  });

  // 5. Student opens page again (new socket, same sessionId, same room)
  const studentSocket2 = io('http://127.0.0.1:4444');
  await new Promise<void>((resolve) => {
    studentSocket2.on('connect', () => {
      studentSocket2.emit('join-room', { roomCode, sessionId: studentSessionId, role: 'student' }, (res: any) => {
        console.log('Student reconnected after refresh:');
        console.log('  Success:', res.success);
        console.log('  IsHost:', res.isHost);
        console.log('  Questions count:', res.questions?.length);
        resolve();
      });
    });
  });

  hostSocket2.disconnect();
  studentSocket2.disconnect();
  server.close();
  process.exit(0);
});
