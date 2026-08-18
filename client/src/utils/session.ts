// Zero-login ephemeral session manager
// Generates a local anonymous UUID per browser to prevent duplicate upvotes
const SESSION_KEY = 'pulse_q_session_id';
const ACTIVE_ROOM_KEY = 'pulse_q_active_room';
const ACTIVE_ROLE_KEY = 'pulse_q_active_role';

export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'anon_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function saveActiveSession(roomCode: string, role: 'host' | 'student') {
  localStorage.setItem(ACTIVE_ROOM_KEY, roomCode.toUpperCase());
  localStorage.setItem(ACTIVE_ROLE_KEY, role);
}

export function getSavedActiveSession(): { roomCode: string; role: 'host' | 'student' } | null {
  const roomCode = localStorage.getItem(ACTIVE_ROOM_KEY);
  const role = localStorage.getItem(ACTIVE_ROLE_KEY) as 'host' | 'student' | null;
  if (roomCode && role) {
    return { roomCode, role };
  }
  return null;
}

export function clearActiveSession() {
  localStorage.removeItem(ACTIVE_ROOM_KEY);
  localStorage.removeItem(ACTIVE_ROLE_KEY);
}
