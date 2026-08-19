import React, { useState, useEffect } from 'react';
import { socket } from '../utils/socket.js';
import {
  getUserNickname,
  setUserNickname,
  getRecentRooms,
  addRecentRoom,
  removeRecentRoom,
  RecentRoom
} from '../utils/session.js';
import { Room, Question } from '../../shared/types.js';
import {
  Sparkles,
  ArrowRight,
  GraduationCap,
  Users,
  ShieldCheck,
  Zap,
  Tag,
  Download,
  AlertCircle,
  Clock,
  Trash2,
  User,
  History
} from 'lucide-react';

interface LandingJoinProps {
  sessionId: string;
  onJoined: (data: { room: Room; questions: Question[]; isHost: boolean }) => void;
}

export const LandingJoin: React.FC<LandingJoinProps> = ({ sessionId, onJoined }) => {
  const [activeTab, setActiveTab] = useState<'join' | 'host'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [topic, setTopic] = useState('');
  const [nickname, setNickname] = useState(() => getUserNickname());
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>(() => getRecentRooms());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-detect room code from URL param: ?room=XYZ123
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      const cleanCode = roomParam.trim().toUpperCase();
      setRoomCode(cleanCode);
      setActiveTab('join');
    }
  }, []);

  const handleNicknameChange = (val: string) => {
    setNickname(val);
    setUserNickname(val);
  };

  const handleJoinCode = (codeToJoin: string, roleToAssume: 'host' | 'student' = 'student') => {
    const cleanCode = codeToJoin.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('Please enter a 6-character room code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    socket.emit(
      'join-room',
      {
        roomCode: cleanCode,
        sessionId,
        role: roleToAssume,
      },
      (res) => {
        setIsLoading(false);
        if (res.success && res.room && res.questions) {
          addRecentRoom(res.room.code, res.room.topic, res.isHost ? 'host' : 'student');
          onJoined({ room: res.room, questions: res.questions, isHost: res.isHost ?? (roleToAssume === 'host') });
        } else {
          setErrorMessage(res.error || 'Room not found or has ended.');
        }
      }
    );
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoinCode(roomCode, 'student');
  };

  const handleCreateHost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMessage('Please enter a lecture or class topic.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    socket.emit('create-room', { topic: topic.trim() }, (res) => {
      if (res.success && res.room) {
        const createdRoom = res.room;
        // Automatically join host into the socket room
        socket.emit(
          'join-room',
          {
            roomCode: createdRoom.code,
            sessionId,
            role: 'host',
          },
          (joinRes) => {
            setIsLoading(false);
            if (joinRes.success && joinRes.room) {
              addRecentRoom(joinRes.room.code, joinRes.room.topic, 'host');
              onJoined({
                room: joinRes.room,
                questions: joinRes.questions || [],
                isHost: true,
              });
            } else {
              setErrorMessage('Room created, but failed to join as host.');
            }
          }
        );
      } else {
        setIsLoading(false);
        setErrorMessage(res.error || 'Failed to create room.');
      }
    });
  };

  const handleRemoveRecent = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    removeRecentRoom(code);
    setRecentRooms(getRecentRooms());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Ambient Blur */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-sky-600/10 blur-[130px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-100">
            Pulse<span className="text-indigo-400">Q</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full">
          <User className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-mono text-slate-300">
            {nickname ? nickname : `Anon #${sessionId.slice(-4).toUpperCase()}`}
          </span>
        </div>
      </header>

      {/* Main Section */}
      <main className="relative z-10 max-w-xl mx-auto w-full px-4 sm:px-6 py-4 flex-1 flex flex-col justify-center">
        {/* Title */}
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
            Anonymous Classroom <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-indigo-300">Q&A HUD</span>
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Zero-login platform allowing students to ask clarifying doubts and upvote questions into a prioritized queue.
          </p>
        </div>

        {/* Action Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
          {/* Tab Selector */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 mb-6">
            <button
              onClick={() => {
                setActiveTab('join');
                setErrorMessage(null);
              }}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                activeTab === 'join'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Join Class</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('host');
                setErrorMessage(null);
              }}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                activeTab === 'host'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Host Session</span>
            </button>
          </div>

          {/* Join Form (Student) */}
          {activeTab === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Enter 6-Character Room Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MATH42"
                    maxLength={6}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-3.5 text-center text-2xl sm:text-3xl font-mono font-extrabold tracking-widest text-indigo-400 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Your Alias / Nickname <span className="text-slate-500">(Optional & Saved)</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => handleNicknameChange(e.target.value)}
                  placeholder="e.g. Alex (or leave blank to stay Anonymous)"
                  maxLength={30}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !roomCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl transition shadow-lg shadow-indigo-600/25 active:scale-98"
              >
                <span>{isLoading ? 'Joining Class...' : 'Join Classroom HUD'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero login &bull; 100% Anonymous &bull; No PII collected</span>
              </div>
            </form>
          )}

          {/* Host Form (Instructor) */}
          {activeTab === 'host' && (
            <form onSubmit={handleCreateHost} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Class Topic / Lecture Name
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. CS 101: Graph Algorithms - Lecture 4"
                  maxLength={80}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !topic.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl transition shadow-lg shadow-indigo-600/25 active:scale-98"
              >
                <span>{isLoading ? 'Creating Room...' : 'Start Live Session'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-xs text-slate-400 pt-1">
                Generates a 6-character room code and shareable QR code for students.
              </p>
            </form>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Recent Classrooms History Card */}
        {recentRooms.length > 0 && (
          <div className="mt-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Your Recent Classrooms</span>
            </div>
            <div className="space-y-2">
              {recentRooms.map((room) => (
                <div
                  key={room.code}
                  onClick={() => handleJoinCode(room.code, room.role)}
                  className="p-3 bg-slate-950/80 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                      {room.code}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition">
                        {room.topic}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span className="capitalize">{room.role === 'host' ? '👑 Host' : '🎓 Student'}</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 inline" />
                          {new Date(room.lastVisited).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleRemoveRecent(e, room.code)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Highlights Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl text-center space-y-1">
            <Zap className="w-4 h-4 text-indigo-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-200">Real-Time Queue</div>
            <div className="text-[11px] text-slate-400">Sub-300ms priority sorting by upvotes</div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl text-center space-y-1">
            <Tag className="w-4 h-4 text-sky-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-200">Slide Tagging</div>
            <div className="text-[11px] text-slate-400">Pin questions to exact slide numbers</div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl text-center space-y-1 col-span-2 sm:col-span-1">
            <Download className="w-4 h-4 text-emerald-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-200">Export & Archive</div>
            <div className="text-[11px] text-slate-400">One-click CSV & Markdown summaries</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-900">
        PulseQ &bull; Lightweight Zero-Login Classroom Q&A HUD
      </footer>
    </div>
  );
};
