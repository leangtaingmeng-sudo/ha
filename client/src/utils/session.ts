// Zero-login ephemeral session manager with client-side user and room history persistence
const SESSION_KEY = 'pulse_q_session_id';
const ACTIVE_ROOM_KEY = 'pulse_q_active_room';
const ACTIVE_ROLE_KEY = 'pulse_q_active_role';
const RECENT_ROOMS_KEY = 'pulse_q_recent_rooms';
const NICKNAME_KEY = 'pulse_q_nickname';

export interface RecentRoom {
  code: string;
  topic: string;
  role: 'host' | 'student';
  lastVisited: number;
}

export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'anon_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function getUserNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) || '';
}

export function setUserNickname(name: string) {
  if (name.trim()) {
    localStorage.setItem(NICKNAME_KEY, name.trim().slice(0, 30));
  } else {
    localStorage.removeItem(NICKNAME_KEY);
  }
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

export function getRecentRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentRoom(code: string, topic: string, role: 'host' | 'student') {
  try {
    const current = getRecentRooms();
    const filtered = current.filter((r) => r.code !== code.toUpperCase());
    const updated: RecentRoom[] = [
      {
        code: code.toUpperCase(),
        topic: topic || 'Classroom Session',
        role,
        lastVisited: Date.now(),
      },
      ...filtered,
    ].slice(0, 6); // Keep last 6 rooms
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save recent room:', err);
  }
}

export function removeRecentRoom(code: string) {
  try {
    const current = getRecentRooms();
    const updated = current.filter((r) => r.code !== code.toUpperCase());
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated));
  } catch {}
}
