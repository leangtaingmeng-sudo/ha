import fs from 'fs';
import path from 'path';
import { Room, Question, QuestionStatus, SessionExportData, SessionStats } from '../shared/types.js';

// Non-ambiguous characters (omitted 0, O, 1, I, L)
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[randomIndex];
  }
  return code;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'pulse_store.json');

export class MemoryStore {
  private rooms: Map<string, Room> = new Map();
  private questions: Map<string, Question[]> = new Map();
  // roomCode -> Set of socket IDs
  private roomSockets: Map<string, Set<string>> = new Map();
  // socketId -> { roomCode, sessionId, role }
  private socketData: Map<string, { roomCode: string; sessionId: string; role: 'host' | 'student' }> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data.rooms && Array.isArray(data.rooms)) {
          for (const r of data.rooms) {
            this.rooms.set(r.code, { ...r, participantCount: 0 });
          }
        }
        if (data.questions && typeof data.questions === 'object') {
          for (const [code, qList] of Object.entries(data.questions)) {
            this.questions.set(code, qList as Question[]);
          }
        }
        console.log(`[PulseQ] Loaded ${this.rooms.size} rooms from persistent disk store.`);
      }
    } catch (err) {
      console.warn('[PulseQ] Could not load data from disk, starting fresh store:', err);
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToDisk();
    }, 500);
    if (this.saveTimeout.unref) {
      this.saveTimeout.unref();
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const serialized = {
        rooms: Array.from(this.rooms.values()),
        questions: Object.fromEntries(this.questions.entries()),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(serialized, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[PulseQ] Error persisting store to disk:', err);
    }
  }

  createRoom(topic: string, hostSessionId?: string): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room: Room = {
      code,
      topic: topic.trim() || 'Untitled Class Session',
      createdAt: Date.now(),
      status: 'active',
      participantCount: 0,
      hostSessionId,
    };

    this.rooms.set(code, room);
    this.questions.set(code, []);
    this.roomSockets.set(code, new Set());

    this.scheduleSave();
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  joinSocket(
    socketId: string,
    roomCode: string,
    sessionId: string,
    role: 'host' | 'student'
  ): { room: Room; questions: Question[]; isHost: boolean } | null {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return null;

    // If joining as host, register this session as the host if not already set
    if (role === 'host') {
      room.hostSessionId = sessionId;
      this.scheduleSave();
    }

    // Auto-detect if user is the room host
    const isHost = role === 'host' || (!!room.hostSessionId && room.hostSessionId === sessionId);

    this.socketData.set(socketId, { roomCode: code, sessionId, role: isHost ? 'host' : 'student' });

    let sockets = this.roomSockets.get(code);
    if (!sockets) {
      sockets = new Set();
      this.roomSockets.set(code, sockets);
    }
    sockets.add(socketId);

    // Update room participant count
    room.participantCount = sockets.size;

    const questions = this.getQuestions(code);
    return { room, questions, isHost };
  }

  leaveSocket(socketId: string): { roomCode: string; participantCount: number } | null {
    const data = this.socketData.get(socketId);
    if (!data) return null;

    const { roomCode } = data;
    this.socketData.delete(socketId);

    const sockets = this.roomSockets.get(roomCode);
    if (sockets) {
      sockets.delete(socketId);
      const room = this.rooms.get(roomCode);
      if (room) {
        room.participantCount = sockets.size;
        return { roomCode, participantCount: sockets.size };
      }
    }

    return null;
  }

  getQuestions(roomCode: string): Question[] {
    const list = this.questions.get(roomCode.toUpperCase()) || [];
    // Sort: 1) Pinned first, 2) Upvotes descending, 3) CreatedAt ascending
    return [...list].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (b.upvotes !== a.upvotes) {
        return b.upvotes - a.upvotes;
      }
      return a.createdAt - b.createdAt;
    });
  }

  addQuestion(
    roomCode: string,
    text: string,
    slideTag: string | undefined,
    sessionId: string
  ): Question | null {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room || room.status === 'ended') return null;

    const sanitizedText = text.trim().slice(0, 280);
    if (!sanitizedText) return null;

    const sanitizedSlide = slideTag?.trim().slice(0, 30) || undefined;

    const question: Question = {
      id: generateId(),
      roomCode: code,
      text: sanitizedText,
      slideTag: sanitizedSlide,
      upvotes: 0,
      voterSessionIds: [],
      status: 'pending',
      isPinned: false,
      createdAt: Date.now(),
      sessionId,
    };

    const list = this.questions.get(code) || [];
    list.push(question);
    this.questions.set(code, list);

    this.scheduleSave();
    return question;
  }

  upvoteQuestion(
    roomCode: string,
    questionId: string,
    sessionId: string
  ): { question: Question; hasUpvoted: boolean } | null {
    const code = roomCode.toUpperCase();
    const list = this.questions.get(code);
    if (!list) return null;

    const question = list.find((q) => q.id === questionId);
    if (!question) return null;

    const voterIndex = question.voterSessionIds.indexOf(sessionId);
    let hasUpvoted = false;

    if (voterIndex === -1) {
      // Add upvote
      question.voterSessionIds.push(sessionId);
      question.upvotes = question.voterSessionIds.length;
      hasUpvoted = true;
    } else {
      // Toggle remove upvote
      question.voterSessionIds.splice(voterIndex, 1);
      question.upvotes = question.voterSessionIds.length;
      hasUpvoted = false;
    }

    this.scheduleSave();
    return { question, hasUpvoted };
  }

  togglePinQuestion(roomCode: string, questionId: string): Question | null {
    const code = roomCode.toUpperCase();
    const list = this.questions.get(code);
    if (!list) return null;

    const question = list.find((q) => q.id === questionId);
    if (!question) return null;

    question.isPinned = !question.isPinned;
    this.scheduleSave();
    return question;
  }

  updateQuestionStatus(
    roomCode: string,
    questionId: string,
    newStatus: QuestionStatus
  ): { updatedQuestion: Question; previousAnswering?: Question } | null {
    const code = roomCode.toUpperCase();
    const list = this.questions.get(code);
    if (!list) return null;

    const question = list.find((q) => q.id === questionId);
    if (!question) return null;

    let previousAnswering: Question | undefined;

    // If new status is 'answering', reset any other question that is currently answering
    if (newStatus === 'answering') {
      for (const q of list) {
        if (q.id !== questionId && q.status === 'answering') {
          q.status = 'pending';
          previousAnswering = q;
        }
      }
      question.answeringAt = Date.now();
    } else if (newStatus === 'resolved') {
      question.resolvedAt = Date.now();
    }

    question.status = newStatus;
    this.scheduleSave();
    return { updatedQuestion: question, previousAnswering };
  }

  deleteQuestion(roomCode: string, questionId: string): boolean {
    const code = roomCode.toUpperCase();
    const list = this.questions.get(code);
    if (!list) return false;

    const index = list.findIndex((q) => q.id === questionId);
    if (index === -1) return false;

    list.splice(index, 1);
    this.scheduleSave();
    return true;
  }

  endSession(roomCode: string): SessionExportData | null {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return null;

    room.status = 'ended';
    room.endedAt = Date.now();

    this.scheduleSave();
    return this.getExportData(code);
  }

  getExportData(roomCode: string): SessionExportData | null {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return null;

    const questions = this.getQuestions(code);
    const resolvedCount = questions.filter((q) => q.status === 'resolved').length;
    const answeringCount = questions.filter((q) => q.status === 'answering').length;
    const pendingCount = questions.filter((q) => q.status === 'pending').length;
    const totalUpvotes = questions.reduce((acc, q) => acc + q.upvotes, 0);

    const startTime = room.createdAt;
    const endTime = room.endedAt || Date.now();
    const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));

    const stats: SessionStats = {
      totalQuestions: questions.length,
      totalUpvotes,
      resolvedCount,
      answeringCount,
      pendingCount,
      durationMinutes,
    };

    return { room, questions, stats };
  }

  generateCSV(roomCode: string): string {
    const exportData = this.getExportData(roomCode);
    if (!exportData) return '';

    const headers = ['ID', 'Question', 'Slide / Section', 'Upvotes', 'Pinned', 'Status', 'Created Time', 'Resolved Time'];
    const rows = exportData.questions.map((q) => {
      const createdStr = new Date(q.createdAt).toISOString();
      const resolvedStr = q.resolvedAt ? new Date(q.resolvedAt).toISOString() : '';
      const slideStr = q.slideTag || 'None';
      const cleanText = `"${q.text.replace(/"/g, '""')}"`;
      return [q.id, cleanText, `"${slideStr}"`, q.upvotes, q.isPinned ? 'Yes' : 'No', q.status, createdStr, resolvedStr].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  generateMarkdown(roomCode: string): string {
    const exportData = this.getExportData(roomCode);
    if (!exportData) return '';

    const { room, questions, stats } = exportData;
    const dateStr = new Date(room.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const resolved = questions.filter((q) => q.status === 'resolved');
    const pending = questions.filter((q) => q.status !== 'resolved');

    let md = `# Lecture Q&A Summary: ${room.topic}\n\n`;
    md += `**Date:** ${dateStr}  \n`;
    md += `**Room Code:** \`${room.code}\`  \n`;
    md += `**Duration:** ~${stats.durationMinutes} minutes  \n`;
    md += `**Total Questions:** ${stats.totalQuestions}  \n`;
    md += `**Total Upvotes:** ${stats.totalUpvotes}  \n`;
    md += `**Answered Questions:** ${stats.resolvedCount} / ${stats.totalQuestions}\n\n`;

    md += `## 🎙️ Answered Questions (${resolved.length})\n\n`;
    if (resolved.length === 0) {
      md += `*No questions were marked as resolved during this session.*\n\n`;
    } else {
      resolved.forEach((q, idx) => {
        const slide = q.slideTag ? ` \`[${q.slideTag}]\`` : '';
        const pinBadge = q.isPinned ? ' 📌 *(Pinned)*' : '';
        md += `${idx + 1}. **${q.text}**${slide}${pinBadge}\n`;
        md += `   - **Upvotes:** ${q.upvotes} | **Submitted:** ${new Date(q.createdAt).toLocaleTimeString()}\n\n`;
      });
    }

    md += `## 📋 Unaddressed Questions (${pending.length})\n\n`;
    if (pending.length === 0) {
      md += `*All student questions were successfully addressed!*\n\n`;
    } else {
      pending.forEach((q, idx) => {
        const slide = q.slideTag ? ` \`[${q.slideTag}]\`` : '';
        const pinBadge = q.isPinned ? ' 📌 *(Pinned)*' : '';
        md += `${idx + 1}. ${q.text}${slide}${pinBadge}\n`;
        md += `   - **Upvotes:** ${q.upvotes} | **Status:** ${q.status}\n\n`;
      });
    }

    md += `---\n*Generated by PulseQ — Classroom Real-Time Q&A HUD*\n`;
    return md;
  }
}

export const memoryStore = new MemoryStore();
