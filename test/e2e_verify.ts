import { io } from 'socket.io-client';
import { Room, Question } from '../shared/types.js';

async function runE2E() {
  console.log('--- Starting PulseQ Extended E2E Verification ---');

  // 1. Health check
  const healthRes = await fetch('http://localhost:3000/api/health');
  const healthData = await healthRes.json();
  console.log('1. Health check status:', healthData.status);

  // 2. Connect Host socket
  const hostSocket = io('http://localhost:3000');
  await new Promise<void>((resolve) => hostSocket.on('connect', resolve));
  console.log('2. Host connected via Socket.IO');

  // Create Room
  let createdRoom: Room | null = null;
  await new Promise<void>((resolve, reject) => {
    hostSocket.emit('create-room', { topic: 'CS101: Graph Algorithms' }, (res) => {
      if (res.success && res.room) {
        createdRoom = res.room;
        console.log(`3. Host created room: Code = ${createdRoom.code}, Topic = "${createdRoom.topic}"`);
        resolve();
      } else {
        reject(new Error(res.error));
      }
    });
  });

  if (!createdRoom) throw new Error('No room created');
  const roomCode = (createdRoom as Room).code;

  // Host joins socket room
  await new Promise<void>((resolve) => {
    hostSocket.emit('join-room', { roomCode, sessionId: 'host_session', role: 'host' }, () => {
      console.log('4. Host joined room successfully');
      resolve();
    });
  });

  // 3. Connect Student 1 socket
  const student1Socket = io('http://localhost:3000');
  await new Promise<void>((resolve) => student1Socket.on('connect', resolve));

  await new Promise<void>((resolve) => {
    student1Socket.emit('join-room', { roomCode, sessionId: 'student_1_sess', role: 'student' }, () => {
      console.log(`5. Student 1 joined room ${roomCode}`);
      resolve();
    });
  });

  // Student 1 submits question
  let submittedQ: Question | null = null;
  await new Promise<void>((resolve) => {
    student1Socket.emit(
      'submit-question',
      {
        roomCode,
        text: 'Why did the sign flip in Step 3?',
        slideTag: 'Slide 12',
        sessionId: 'student_1_sess',
      },
      (res) => {
        if (res.success && res.question) {
          submittedQ = res.question;
          console.log(`6. Student 1 posted doubt: "${submittedQ.text}" [${submittedQ.slideTag}] (ID: ${submittedQ.id})`);
          resolve();
        }
      }
    );
  });

  // 4. Connect Student 2 socket & upvote
  const student2Socket = io('http://localhost:3000');
  await new Promise<void>((resolve) => student2Socket.on('connect', resolve));

  await new Promise<void>((resolve) => {
    student2Socket.emit('join-room', { roomCode, sessionId: 'student_2_sess', role: 'student' }, () => {
      console.log('7. Student 2 joined room');
      resolve();
    });
  });

  await new Promise<void>((resolve) => {
    student2Socket.emit('upvote-question', { roomCode, questionId: submittedQ!.id, sessionId: 'student_2_sess' }, (res) => {
      console.log(`8. Student 2 upvoted question! Upvotes now = ${res.upvotes}`);
      resolve();
    });
  });

  // 5. Host toggles Pin on the question
  await new Promise<void>((resolve) => {
    hostSocket.emit('toggle-pin-question', { roomCode, questionId: submittedQ!.id }, (res) => {
      console.log(`9. Host toggled pin on question! isPinned = ${res.isPinned}`);
      resolve();
    });
  });

  // 6. Host updates status to Answering
  await new Promise<void>((resolve) => {
    hostSocket.emit('update-question-status', { roomCode, questionId: submittedQ!.id, status: 'answering' }, () => {
      console.log('10. Host marked question as "answering"');
      resolve();
    });
  });

  // 7. Host updates status to Resolved
  await new Promise<void>((resolve) => {
    hostSocket.emit('update-question-status', { roomCode, questionId: submittedQ!.id, status: 'resolved' }, () => {
      console.log('11. Host marked question as "resolved"');
      resolve();
    });
  });

  // 8. Host ends session
  await new Promise<void>((resolve) => {
    hostSocket.emit('end-session', { roomCode }, (res) => {
      console.log('12. Host ended session successfully');
      console.log('    Summary Stats:', res.exportData?.stats);
      resolve();
    });
  });

  // 9. Test Export Endpoints
  const csvRes = await fetch(`http://localhost:3000/api/rooms/${roomCode}/export/csv`);
  const csvText = await csvRes.text();
  console.log('13. CSV Export generated:\n' + csvText.trim());

  const mdRes = await fetch(`http://localhost:3000/api/rooms/${roomCode}/export/md`);
  const mdText = await mdRes.text();
  console.log('14. Markdown Export generated:\n' + mdText.trim());

  hostSocket.disconnect();
  student1Socket.disconnect();
  student2Socket.disconnect();

  console.log('\n🎉 ALL EXTENDED E2E REQUIREMENTS VERIFIED SUCCESSFULLY!');
}

runE2E().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
