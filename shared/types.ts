export type QuestionStatus = 'pending' | 'answering' | 'resolved';

export interface Question {
  id: string;
  roomCode: string;
  text: string;
  slideTag?: string;
  upvotes: number;
  voterSessionIds: string[];
  status: QuestionStatus;
  isPinned?: boolean;
  createdAt: number;
  answeringAt?: number;
  resolvedAt?: number;
  sessionId: string;
}

export interface Room {
  code: string;
  topic: string;
  createdAt: number;
  endedAt?: number;
  status: 'active' | 'ended';
  participantCount: number;
  hostSessionId?: string;
}

export interface SessionStats {
  totalQuestions: number;
  totalUpvotes: number;
  resolvedCount: number;
  answeringCount: number;
  pendingCount: number;
  durationMinutes: number;
}

export interface SessionExportData {
  room: Room;
  questions: Question[];
  stats: SessionStats;
}

// Client to Server Events
export interface ClientToServerEvents {
  'create-room': (
    payload: { topic: string },
    callback: (res: { success: boolean; room?: Room; error?: string }) => void
  ) => void;

  'join-room': (
    payload: { roomCode: string; sessionId: string; role: 'host' | 'student' },
    callback: (res: {
      success: boolean;
      room?: Room;
      questions?: Question[];
      isHost?: boolean;
      error?: string;
    }) => void
  ) => void;

  'submit-question': (
    payload: { roomCode: string; text: string; slideTag?: string; sessionId: string },
    callback: (res: { success: boolean; question?: Question; error?: string }) => void
  ) => void;

  'upvote-question': (
    payload: { roomCode: string; questionId: string; sessionId: string },
    callback: (res: { success: boolean; upvotes?: number; error?: string }) => void
  ) => void;

  'update-question-status': (
    payload: { roomCode: string; questionId: string; status: QuestionStatus },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'toggle-pin-question': (
    payload: { roomCode: string; questionId: string },
    callback: (res: { success: boolean; isPinned?: boolean; error?: string }) => void
  ) => void;

  'delete-question': (
    payload: { roomCode: string; questionId: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'end-session': (
    payload: { roomCode: string },
    callback: (res: { success: boolean; exportData?: SessionExportData; error?: string }) => void
  ) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  'room-updated': (room: Room) => void;
  'participant-count': (count: number) => void;
  'question-added': (question: Question) => void;
  'question-updated': (question: Question) => void;
  'question-deleted': (data: { questionId: string }) => void;
  'questions-synced': (questions: Question[]) => void;
  'session-ended': (data: { roomCode: string; exportData: SessionExportData }) => void;
  'error-notification': (data: { message: string }) => void;
}
