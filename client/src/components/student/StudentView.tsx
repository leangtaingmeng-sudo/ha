import React, { useState, useEffect } from 'react';
import { Room, Question } from '../../../shared/types.js';
import { socket } from '../../utils/socket.js';
import { soundManager } from '../../utils/audio.js';
import {
  MessageSquarePlus,
  Send,
  ThumbsUp,
  Radio,
  Clock,
  Sparkles,
  Tag,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  AlertCircle,
  Share2,
  Check,
  Pin,
  Flame,
  WifiOff
} from 'lucide-react';

interface StudentViewProps {
  room: Room;
  questions: Question[];
  sessionId: string;
  onLeaveRoom: () => void;
}

const QUICK_SLIDES = ['Slide 1', 'Slide 2', 'Slide 3', 'Slide 4', 'Slide 5', 'Slide 10', 'Derivation', 'Code'];

export const StudentView: React.FC<StudentViewProps> = ({
  room,
  questions,
  sessionId,
  onLeaveRoom,
}) => {
  const [questionText, setQuestionText] = useState('');
  const [slideTag, setSlideTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'unresolved' | 'resolved' | 'mine'>('all');
  const [sortBy, setSortBy] = useState<'upvotes' | 'recent'>('upvotes');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  const MAX_CHARS = 280;
  const charsLeft = MAX_CHARS - questionText.length;

  const handleShare = async () => {
    const joinUrl = `${window.location.origin}/?room=${room.code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${room.topic} on PulseQ`,
          text: `Ask questions anonymously in our class room: ${room.code}`,
          url: joinUrl,
        });
        return;
      } catch {}
    }
    // Fallback to clipboard
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      setErrorMessage('Please type a question before submitting.');
      return;
    }
    if (questionText.length > MAX_CHARS) {
      setErrorMessage(`Question must be under ${MAX_CHARS} characters.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    socket.emit(
      'submit-question',
      {
        roomCode: room.code,
        text: questionText.trim(),
        slideTag: slideTag.trim() || undefined,
        sessionId,
      },
      (res) => {
        setIsSubmitting(false);
        if (res.success) {
          soundManager.playNewQuestion();
          setQuestionText('');
          setSlideTag('');
          setSuccessMessage('Your anonymous question was posted!');
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setErrorMessage(res.error || 'Failed to submit question.');
        }
      }
    );
  };

  const handleUpvote = (questionId: string) => {
    soundManager.playUpvote();
    socket.emit('upvote-question', {
      roomCode: room.code,
      questionId,
      sessionId,
    }, (res) => {
      if (!res.success && res.error) {
        setErrorMessage(res.error);
        setTimeout(() => setErrorMessage(null), 3000);
      }
    });
  };

  // Find question currently being answered
  const answeringQuestion = questions.find((q) => q.status === 'answering');

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    if (filterTab === 'unresolved') return q.status !== 'resolved';
    if (filterTab === 'resolved') return q.status === 'resolved';
    if (filterTab === 'mine') return q.sessionId === sessionId;
    return true;
  });

  // Sort questions: Pinned first, then sortBy
  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (sortBy === 'upvotes') {
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      return a.createdAt - b.createdAt;
    }
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-12">
      {/* Offline banner if connection drops */}
      {!isConnected && (
        <div className="bg-amber-600/90 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-1.5 z-50">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Reconnecting to classroom server...</span>
        </div>
      )}

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-400 animate-pulse-subtle' : 'bg-amber-400'}`} />
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-100 truncate">{room.topic}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Room <strong className="font-mono text-indigo-400">{room.code}</strong></span>
                <span>&bull;</span>
                <span className="text-emerald-400 font-medium">Anonymous Student</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition border border-slate-700/60"
              title="Share room with classmates"
              aria-label="Share room link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onLeaveRoom}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700/60"
            >
              Leave
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-4 space-y-4 flex-1">
        {/* Active Spotlight Banner if Teacher is Answering */}
        {answeringQuestion && (
          <div className="bg-gradient-to-r from-sky-950/80 via-slate-900 to-indigo-950/80 border-2 border-sky-400/80 rounded-2xl p-4 sm:p-5 glow-active relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400" />
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Radio className="w-4 h-4 animate-pulse text-sky-400" />
              <span>Instructor is answering now</span>
            </div>
            <p className="text-slate-100 font-medium text-base sm:text-lg mb-3">
              "{answeringQuestion.text}"
            </p>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {answeringQuestion.slideTag && (
                <span className="px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  🏷️ {answeringQuestion.slideTag}
                </span>
              )}
              <span className="text-slate-400 flex items-center gap-1">
                <ThumbsUp className="w-3.5 h-3.5 text-indigo-400" /> {answeringQuestion.upvotes} upvotes
              </span>
            </div>
          </div>
        )}

        {/* Question Submission Card */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden transition">
          <button
            type="button"
            onClick={() => setIsComposerOpen(!isComposerOpen)}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MessageSquarePlus className="w-4 h-4 text-indigo-400" />
              <span>Ask an Anonymous Question</span>
            </div>
            {isComposerOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {isComposerOpen && (
            <form onSubmit={handleSubmit} className="p-4 pt-1 border-t border-slate-800/60 space-y-3">
              <div className="relative">
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="What would you like clarified? (e.g. Why did the sign flip in Step 3?)"
                  rows={3}
                  maxLength={MAX_CHARS}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> 100% Anonymous
                  </span>
                  <span className={charsLeft < 20 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                    {charsLeft} chars left
                  </span>
                </div>
              </div>

              {/* Quick Slide Tag suggestions */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <span>Quick Tag:</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {QUICK_SLIDES.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSlideTag(slideTag === tag ? '' : tag)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] transition flex-shrink-0 ${
                        slideTag === tag
                          ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1 sm:max-w-[200px]">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={slideTag}
                    onChange={(e) => setSlideTag(e.target.value)}
                    placeholder="Slide / Section # (opt)"
                    maxLength={30}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !questionText.trim()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Posting...' : 'Post Doubt'}</span>
                </button>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex items-center justify-between gap-2 pt-2 pb-1 text-xs">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl overflow-x-auto">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({questions.length})
            </button>
            <button
              onClick={() => setFilterTab('unresolved')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterTab === 'unresolved'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Open ({questions.filter((q) => q.status !== 'resolved').length})
            </button>
            <button
              onClick={() => setFilterTab('resolved')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterTab === 'resolved'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resolved ({questions.filter((q) => q.status === 'resolved').length})
            </button>
            <button
              onClick={() => setFilterTab('mine')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterTab === 'mine'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mine ({questions.filter((q) => q.sessionId === sessionId).length})
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSortBy(sortBy === 'upvotes' ? 'recent' : 'upvotes')}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition flex items-center gap-1 text-xs"
            >
              {sortBy === 'upvotes' ? '🔥 Top Voted' : '⏱️ Most Recent'}
            </button>
          </div>
        </div>

        {/* Live Question Feed */}
        <div className="space-y-3">
          {sortedQuestions.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-900/40 border border-dashed border-slate-800/80 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">No questions yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Have a doubt about the current topic or slide? Ask anonymously above and let classmates upvote!
              </p>
            </div>
          ) : (
            sortedQuestions.map((question) => {
              const hasUpvoted = question.voterSessionIds.includes(sessionId);
              const isMine = question.sessionId === sessionId;
              const isAnswering = question.status === 'answering';
              const isResolved = question.status === 'resolved';
              const isHighDemand = question.upvotes >= 3;

              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-2xl border transition relative ${
                    isAnswering
                      ? 'bg-slate-900/95 border-sky-400/70 shadow-lg shadow-sky-950/50 glow-active'
                      : question.isPinned
                      ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md'
                      : isResolved
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-80'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      {/* Status and Badges */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {question.isPinned && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40">
                            <Pin className="w-3 h-3" /> Pinned
                          </span>
                        )}
                        {isAnswering && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-400/40 animate-pulse-subtle">
                            <Radio className="w-3 h-3" /> Answering
                          </span>
                        )}
                        {isHighDemand && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            <Flame className="w-3 h-3 text-amber-400" /> High Demand
                          </span>
                        )}
                        {isResolved && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Answered
                          </span>
                        )}
                        {question.slideTag && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-medium border border-slate-700">
                            🏷️ {question.slideTag}
                          </span>
                        )}
                        {isMine && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-medium border border-indigo-500/20">
                            Your Doubt
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <p className={`text-sm leading-relaxed ${isResolved ? 'text-slate-300 line-through/20' : 'text-slate-100 font-medium'}`}>
                        {question.text}
                      </p>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(question.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Upvote Button */}
                    <button
                      onClick={() => handleUpvote(question.id)}
                      disabled={isResolved}
                      className={`flex flex-col items-center justify-center min-w-[50px] p-2.5 rounded-xl transition border ${
                        hasUpvoted
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30 active:scale-95'
                          : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-indigo-400 active:scale-95'
                      } ${isResolved ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={hasUpvoted ? 'Remove upvote' : 'Upvote this doubt'}
                      aria-label="Upvote question"
                    >
                      <ThumbsUp
                        className={`w-4 h-4 mb-0.5 transition ${
                          hasUpvoted ? 'fill-white stroke-white' : ''
                        }`}
                      />
                      <span className="text-xs font-bold font-mono">{question.upvotes}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};
