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
import { Room, Question, SessionExportData } from '../../shared/types.js';
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
  History,
  Eye,
  RotateCcw,
  X,
  FileText
} from 'lucide-react';

interface LandingJoinProps {
  sessionId: string;
  onJoined: (data: { room: Room; questions: Question[]; isHost: boolean }) => void;
  onViewArchive: (exportData: SessionExportData, role?: 'host' | 'student') => void;
}

export const LandingJoin: React.FC<LandingJoinProps> = ({
  sessionId,
  onJoined,
  onViewArchive,
}) => {
  const [activeTab, setActiveTab] = useState<'join' | 'host'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [topic, setTopic] = useState('');
  const [nickname, setNickname] = useState(() => getUserNickname());
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>(() => getRecentRooms());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedHistoryRoom, setSelectedHistoryRoom] = useState<RecentRoom | null>(null);

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
          // If room ended, automatically offer to view archive
          handleViewArchive(cleanCode, roleToAssume);
        }
      }
    );
  };

  const handleViewArchive = (code: string, role: 'host' | 'student' = 'student') => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedHistoryRoom(null);

    socket.emit('get-room-archive', { roomCode: code }, (res) => {
      setIsLoading(false);
      if (res && res.success && res.exportData) {
        onViewArchive(res.exportData, role);
      } else {
        // Fallback: build read-only summary from recent room record
        const recent = recentRooms.find((r) => r.code === code);
        const fallbackData: SessionExportData = {
          room: {
            code,
            topic: recent?.topic || 'Classroom Session',
            createdAt: recent?.lastVisited || Date.now(),
            status: 'ended',
            participantCount: 0,
          },
          questions: [],
          stats: {
            totalQuestions: 0,
            totalUpvotes: 0,
            resolvedCount: 0,
            answeringCount: 0,
            pendingCount: 0,
            durationMinutes: 45,
          },
        };
        onViewArchive(fallbackData, role);
      }
    });
  };

  const handleReopen = (code: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedHistoryRoom(null);

    socket.emit('reopen-room', { roomCode: code, sessionId }, (res) => {
      setIsLoading(false);
      if (res && res.success && res.room) {
        addRecentRoom(res.room.code, res.room.topic, 'host');
        onJoined({
          room: res.room,
          questions: res.questions || [],
          isHost: true,
        });
      } else {
        // Fallback: restore-room
        socket.emit('restore-room', { roomCode: code, sessionId }, (restoreRes) => {
          if (restoreRes && restoreRes.success && restoreRes.room) {
            addRecentRoom(restoreRes.room.code, restoreRes.room.topic, 'host');
            onJoined({
              room: restoreRes.room,
              questions: restoreRes.questions || [],
              isHost: true,
            });
          } else {
            setErrorMessage(res?.error || 'Failed to reopen classroom.');
          }
        });
      }
    });
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
              setErrorMessage('Failed to enter room as host.');
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
    if (selectedHistoryRoom?.code === code) {
      setSelectedHistoryRoom(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              PulseQ
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 block -mt-1 font-semibold">
              Live Q&A HUD
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              placeholder="Your Alias (opt)"
              maxLength={25}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-32 sm:w-40 transition"
              title="Set your custom display nickname"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero Login &bull; Anonymous</span>
          </div>
        </div>
      </header>

      {/* Hero & Main Action Card */}
      <main className="relative z-10 max-w-md mx-auto w-full px-4 sm:px-6 py-4 flex-1 flex flex-col justify-center">
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Classroom doubts,{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
              ranked in real time.
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            No accounts or downloads needed. Ask anonymously and upvote questions during lecture.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl relative">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800/80 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('join');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === 'join'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Join Class</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('host');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === 'host'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Host Session</span>
            </button>
          </div>

          {/* Form Content */}
          {activeTab === 'join' ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Enter 6-Character Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="e.g. MATH42"
                  maxLength={8}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-3 text-center text-xl font-mono font-bold tracking-widest text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !roomCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl transition shadow-lg shadow-indigo-600/25 active:scale-98"
              >
                <span>{isLoading ? 'Connecting...' : 'Join Classroom HUD'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-xs text-slate-400 pt-1">
                Ask your professor for the 6-character room code or scan the projection QR code.
              </p>
            </form>
          ) : (
            <form onSubmit={handleCreateHost} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Lecture / Class Topic
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
          <div className="mt-6 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Your Recent Classrooms</span>
              </div>
              <span className="text-[11px] font-normal text-slate-500">Click to view or reopen</span>
            </div>

            <div className="space-y-2">
              {recentRooms.map((room) => (
                <div
                  key={room.code}
                  onClick={() => setSelectedHistoryRoom(room)}
                  className="p-3 bg-slate-950/80 hover:bg-slate-800/70 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition cursor-pointer flex items-center justify-between group"
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
                    {/* Quick View Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewArchive(room.code, room.role);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-indigo-600/20 rounded-lg transition"
                      title="View Archive (Read-Only)"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Remove button */}
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

        {/* Action Choice Modal when clicking a History Room */}
        {selectedHistoryRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <button
                onClick={() => setSelectedHistoryRoom(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-400 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600/20 border border-indigo-500/30">
                    {selectedHistoryRoom.code}
                  </span>
                  <span className="text-slate-400 capitalize">{selectedHistoryRoom.role === 'host' ? '👑 Host' : '🎓 Student'}</span>
                </div>
                <h3 className="text-base font-bold text-slate-100 truncate">
                  {selectedHistoryRoom.topic}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  How would you like to open this classroom?
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {/* 1. View Archive (Read-Only) */}
                <button
                  onClick={() => handleViewArchive(selectedHistoryRoom.code, selectedHistoryRoom.role)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl transition group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">View Archive (Read-Only)</div>
                      <div className="text-[11px] text-slate-400">Review all questions & download summary</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition" />
                </button>

                {/* 2. Reopen / Resume Live HUD */}
                <button
                  onClick={() => {
                    if (selectedHistoryRoom.role === 'host') {
                      handleReopen(selectedHistoryRoom.code);
                    } else {
                      handleJoinCode(selectedHistoryRoom.code, 'student');
                    }
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/40 rounded-2xl transition group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center group-hover:scale-105 transition">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        {selectedHistoryRoom.role === 'host' ? 'Reopen Live HUD' : 'Join Live Session'}
                      </div>
                      <div className="text-[11px] text-indigo-300">
                        {selectedHistoryRoom.role === 'host' ? 'Resume accepting questions' : 'Connect to live room'}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-300 group-hover:translate-x-0.5 transition" />
                </button>
              </div>

              <button
                onClick={() => setSelectedHistoryRoom(null)}
                className="w-full py-2.5 text-center text-xs font-medium text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
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
export default LandingJoin;
