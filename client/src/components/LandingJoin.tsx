import React, { useState, useEffect } from 'react';
import { socket } from '../utils/socket.js';
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
  AlertCircle
} from 'lucide-react';

interface LandingJoinProps {
  sessionId: string;
  onJoined: (data: { room: Room; questions: Question[]; isHost: boolean }) => void;
}

export const LandingJoin: React.FC<LandingJoinProps> = ({ sessionId, onJoined }) => {
  const [activeTab, setActiveTab] = useState<'join' | 'host'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [topic, setTopic] = useState('');
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

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
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
        role: 'student',
      },
      (res) => {
        setIsLoading(false);
        if (res.success && res.room && res.questions) {
          onJoined({ room: res.room, questions: res.questions, isHost: false });
        } else {
          setErrorMessage(res.error || 'Room not found. Please verify the 6-character code.');
        }
      }
    );
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

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-300">Live Q&A Engine</span>
        </div>
      </header>

      {/* Main Section */}
      <main className="relative z-10 max-w-xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col justify-center">
        {/* Title */}
        <div className="text-center space-y-2 mb-8">
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

        {/* Feature Highlights Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
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
