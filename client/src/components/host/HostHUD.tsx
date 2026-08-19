import React, { useState, useMemo } from 'react';
import { Room, Question, QuestionStatus, SessionExportData } from '../../../shared/types.js';
import { socket } from '../../utils/socket.js';
import { soundManager } from '../../utils/audio.js';
import { triggerConfetti } from '../../utils/confetti.js';
import { QRCodeModal } from '../common/QRCodeModal.js';
import {
  QrCode,
  Users,
  Copy,
  Check,
  Radio,
  CheckCircle2,
  Trash2,
  Search,
  MessageSquare,
  ThumbsUp,
  Clock,
  Sparkles,
  Power,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Pin,
  PinOff,
  Flame
} from 'lucide-react';

interface HostHUDProps {
  room: Room;
  questions: Question[];
  onEndSession: (exportData: SessionExportData) => void;
  onNewSession: () => void;
}

export const HostHUD: React.FC<HostHUDProps> = ({
  room,
  questions,
  onEndSession,
  onNewSession,
}) => {
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'resolved'>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlide, setSelectedSlide] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundManager.getIsMuted());

  // Extract unique slide tags for filter chips
  const uniqueSlideTags = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.slideTag) set.add(q.slideTag);
    });
    return Array.from(set).sort();
  }, [questions]);

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  // Questions lifecycle handlers
  const handleUpdateStatus = (questionId: string, status: QuestionStatus) => {
    if (status === 'resolved') {
      soundManager.playResolved();
      // If resolving the last unanswered question, trigger celebratory confetti!
      const remainingUnresolved = questions.filter((q) => q.status !== 'resolved' && q.id !== questionId);
      if (remainingUnresolved.length === 0) {
        triggerConfetti();
      }
    }

    socket.emit('update-question-status', {
      roomCode: room.code,
      questionId,
      status,
    }, (res) => {
      if (res && !res.success) {
        console.error('Failed to update question status:', res.error);
      }
    });
  };

  const handleTogglePin = (questionId: string) => {
    socket.emit('toggle-pin-question', {
      roomCode: room.code,
      questionId,
    }, (res) => {
      if (res && !res.success) {
        console.error('Failed to toggle pin:', res.error);
      }
    });
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (window.confirm('Dismiss this question from the queue?')) {
      socket.emit('delete-question', {
        roomCode: room.code,
        questionId,
      }, (res) => {
        if (res && !res.success) {
          console.error('Failed to delete question:', res.error);
        }
      });
    }
  };

  const handleEndSession = () => {
    if (window.confirm('Are you sure you want to end this class session? The room will be locked for submissions and exported.')) {
      setIsEnding(true);

      // Construct robust export data
      const resolvedList = questions.filter((q) => q.status === 'resolved');
      const answeringList = questions.filter((q) => q.status === 'answering');
      const pendingList = questions.filter((q) => q.status !== 'resolved');
      const totalUpvotes = questions.reduce((acc, q) => acc + q.upvotes, 0);

      const localExportData: SessionExportData = {
        room: { ...room, status: 'ended', endedAt: Date.now() },
        questions,
        stats: {
          totalQuestions: questions.length,
          totalUpvotes,
          resolvedCount: resolvedList.length,
          answeringCount: answeringList.length,
          pendingCount: pendingList.length,
          durationMinutes: Math.max(1, Math.round((Date.now() - room.createdAt) / 60000)),
        },
      };

      triggerConfetti();

      // Emit to server to lock the room and notify students
      socket.emit('end-session', { roomCode: room.code }, (res) => {
        setIsEnding(false);
        if (res && res.success && res.exportData) {
          onEndSession(res.exportData);
        } else {
          onEndSession(localExportData);
        }
      });

      // Safety fallback: ensure export modal always opens even if server acknowledgment is delayed
      setTimeout(() => {
        setIsEnding(false);
        onEndSession(localExportData);
      }, 500);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Find currently answering question
  const answeringQuestion = questions.find((q) => q.status === 'answering');

  // Filter questions for priority queue vs resolved
  const unansweredList = questions.filter((q) => q.status !== 'resolved');
  const resolvedList = questions.filter((q) => q.status === 'resolved');

  const currentList = activeTab === 'queue' ? unansweredList : resolvedList;

  const filteredQuestions = currentList.filter((q) => {
    const matchesSearch =
      q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.slideTag && q.slideTag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSlide = selectedSlide === 'all' || q.slideTag === selectedSlide;

    return matchesSearch && matchesSlide;
  });

  const totalUpvotes = questions.reduce((acc, q) => acc + q.upvotes, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Instructor Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Room Topic & Code */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-black">
              HUD
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2 truncate max-w-[280px] sm:max-w-md">
                {room.topic}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 hover:text-indigo-300 font-mono transition"
                  title="Click to copy code"
                >
                  Room: <strong className="text-indigo-400 font-bold">{room.code}</strong>
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400 inline" /> : <Copy className="w-3 h-3 text-slate-500 inline" />}
                </button>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Users className="w-3.5 h-3.5" />
                  {room.participantCount} active {room.participantCount === 1 ? 'user' : 'users'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-xl border transition ${
                isMuted
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
              }`}
              title={isMuted ? 'Unmute HUD Audio Chimes' : 'Mute HUD Audio Chimes'}
              aria-label="Toggle Sound"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-700 shadow-sm active:scale-95"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>Join QR</span>
            </button>

            <button
              onClick={handleEndSession}
              disabled={isEnding || room.status === 'ended'}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold rounded-xl transition active:scale-95"
            >
              <Power className="w-4 h-4 text-rose-400" />
              <span>End & Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6 flex-1">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Doubts in Queue</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-100">{unansweredList.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Total Upvotes</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-400">{totalUpvotes}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <ThumbsUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Now Answering</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-sky-400">
                {answeringQuestion ? '1' : '0'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Radio className={`w-5 h-5 ${answeringQuestion ? 'animate-pulse' : ''}`} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Resolved Doubts</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{resolvedList.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Live Spotlight Card (Currently Answering) */}
        {answeringQuestion && (
          <div className="bg-gradient-to-r from-sky-950/90 via-slate-900 to-indigo-950/90 border-2 border-sky-400 rounded-3xl p-5 sm:p-6 shadow-2xl glow-active flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                <Radio className="w-4 h-4 animate-pulse text-sky-400" />
                <span>Currently Answering in Class</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-slate-100">
                "{answeringQuestion.text}"
              </p>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                {answeringQuestion.slideTag && (
                  <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                    🏷️ {answeringQuestion.slideTag}
                  </span>
                )}
                <span className="flex items-center gap-1 font-medium text-slate-300">
                  <ThumbsUp className="w-3.5 h-3.5 text-indigo-400" /> {answeringQuestion.upvotes} upvotes
                </span>
                <span>&bull;</span>
                <span>Asked at {new Date(answeringQuestion.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => handleUpdateStatus(answeringQuestion.id, 'resolved')}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-emerald-600/30 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Resolved</span>
              </button>

              <button
                onClick={() => handleUpdateStatus(answeringQuestion.id, 'pending')}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition border border-slate-700"
                title="Return to pending queue"
              >
                Pause
              </button>
            </div>
          </div>
        )}

        {/* Queue Navigation & Filter Bar */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Tab switchers */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('queue')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                  activeTab === 'queue'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Priority Queue ({unansweredList.length})
              </button>
              <button
                onClick={() => setActiveTab('resolved')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                  activeTab === 'resolved'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Resolved Archive ({resolvedList.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions or slides..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Slide Filter Chips (if any exist) */}
          {uniqueSlideTags.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1 text-xs">
              <div className="text-slate-400 flex items-center gap-1 mr-1 flex-shrink-0 font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Slide:
              </div>
              <button
                onClick={() => setSelectedSlide('all')}
                className={`px-3 py-1 rounded-lg font-medium transition flex-shrink-0 ${
                  selectedSlide === 'all'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                All Slides
              </button>
              {uniqueSlideTags.map((slide) => (
                <button
                  key={slide}
                  onClick={() => setSelectedSlide(slide)}
                  className={`px-3 py-1 rounded-lg font-medium transition flex-shrink-0 ${
                    selectedSlide === slide
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {slide}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority Question List */}
        <div className="space-y-3">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/40 border border-dashed border-slate-800/80 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">
                {activeTab === 'queue' ? 'Queue is clear!' : 'No resolved questions yet'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {activeTab === 'queue'
                  ? 'No pending questions from students. Have them scan the QR code to post doubts.'
                  : 'Questions you mark as resolved will appear here for post-lecture review.'}
              </p>
            </div>
          ) : (
            filteredQuestions.map((q, index) => {
              const isAnswering = q.status === 'answering';
              const isResolved = q.status === 'resolved';
              const isHighDemand = q.upvotes >= 3;

              return (
                <div
                  key={q.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isAnswering
                      ? 'bg-slate-900/90 border-sky-400/80 shadow-lg glow-active'
                      : q.isPinned
                      ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md'
                      : isResolved
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-80'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Rank, Votes, and Question Text */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Rank Badge for Queue */}
                    {activeTab === 'queue' && (
                      <div className="flex flex-col items-center justify-center min-w-[42px] h-[42px] rounded-xl bg-slate-950 border border-slate-800 flex-shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium uppercase">
                          {q.isPinned ? 'PIN' : 'Rank'}
                        </span>
                        <span className="text-sm font-extrabold text-indigo-400">
                          {q.isPinned ? '📌' : `#${index + 1}`}
                        </span>
                      </div>
                    )}

                    {/* Upvote Pill */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold font-mono text-sm flex-shrink-0 ${
                      isHighDemand
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-sm'
                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                    }`}>
                      <ThumbsUp className="w-4 h-4" />
                      <span>{q.upvotes}</span>
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      {/* Meta Tags */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {q.isPinned && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40 flex items-center gap-1">
                            <Pin className="w-3 h-3" /> Pinned
                          </span>
                        )}
                        {isHighDemand && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-400" /> High Demand
                          </span>
                        )}
                        {q.slideTag && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-semibold border border-slate-700">
                            🏷️ {q.slideTag}
                          </span>
                        )}
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isAnswering && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-400/40 animate-pulse-subtle">
                            Speaking Now
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <p className={`text-sm sm:text-base font-semibold ${isResolved ? 'text-slate-300' : 'text-slate-100'}`}>
                        {q.text}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                    {/* Pin button */}
                    <button
                      onClick={() => handleTogglePin(q.id)}
                      className={`p-2 rounded-xl border transition ${
                        q.isPinned
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800 border-transparent hover:border-slate-700'
                      }`}
                      title={q.isPinned ? 'Unpin doubt' : 'Pin to top of queue'}
                      aria-label="Pin question"
                    >
                      {q.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>

                    {q.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(q.id, 'answering')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-indigo-600/20 active:scale-95"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Start Answering</span>
                      </button>
                    )}

                    {q.status !== 'resolved' ? (
                      <button
                        onClick={() => handleUpdateStatus(q.id, 'resolved')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl transition active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resolve</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(q.id, 'pending')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition border border-slate-700"
                        title="Move back to pending queue"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>Reopen</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition border border-transparent hover:border-rose-500/20"
                      title="Dismiss/Delete question"
                      aria-label="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* QR Code Modal */}
      <QRCodeModal
        roomCode={room.code}
        topic={room.topic}
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
      />
    </div>
  );
};
