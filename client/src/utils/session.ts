// Zero-login ephemeral session manager
// Generates a local anonymous UUID per browser to prevent duplicate upvotes
const SESSION_KEY = 'pulse_q_session_id';

export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'anon_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}
