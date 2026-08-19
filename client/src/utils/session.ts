// Zero-login ephemeral session manager with client-side user and room history persistence
const SESSION_KEY = 'pulse_q_session_id';
const ACTIVE_ROOM_KEY = 'pulse_q_active_room';
const ACTIVE_ROLE_KEY = 'pulse_q_active_role';
const ACTIVE_TOPIC_KEY = 'pulse_q_active_topic';
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
    sessionId = 'anon_' + crypto.randomUUID().replace(/-/g, '');
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

export function saveActiveSession(roomCode: string, role: 'host' | 'student', topic?: string) {
  localStorage.setItem(ACTIVE_ROOM_KEY, roomCode.toUpperCase());
  localStorage.setItem(ACTIVE_ROLE_KEY, role);
  if (topic) {
    localStorage.setItem(ACTIVE_TOPIC_KEY, topic);
  }
}

export function getSavedActiveSession(): { roomCode: string; role: 'host' | 'student'; topic?: string } | null {
  const roomCode = localStorage.getItem(ACTIVE_ROOM_KEY);
  const role = localStorage.getItem(ACTIVE_ROLE_KEY) as 'host' | 'student' | null;
  const topic = localStorage.getItem(ACTIVE_TOPIC_KEY) || undefined;
  if (roomCode && role) {
    return { roomCode, role, topic };
  }
  return null;
}

export function clearActiveSession() {
  localStorage.removeItem(ACTIVE_ROOM_KEY);
  localStorage.removeItem(ACTIVE_ROLE_KEY);
  localStorage.removeItem(ACTIVE_TOPIC_KEY);
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
    ].slice(0, 8); // Keep last 8 rooms
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
