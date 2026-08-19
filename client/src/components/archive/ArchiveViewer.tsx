import React, { useState } from 'react';
import { SessionExportData } from '../../../shared/types.js';
import {
  ArrowLeft,
  Download,
  FileText,
  CheckCircle2,
  MessageSquare,
  ThumbsUp,
  Clock,
  Sparkles,
  RotateCcw,
  Tag,
  Check,
  Copy,
  Inbox,
  HelpCircle,
  Pin
} from 'lucide-react';

interface ArchiveViewerProps {
  exportData: SessionExportData;
  userRole?: 'host' | 'student';
  onBackToMain: () => void;
  onReopenRoom?: (roomCode: string) => void;
}

export const ArchiveViewer: React.FC<ArchiveViewerProps> = ({
  exportData,
  userRole,
  onBackToMain,
  onReopenRoom,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [copiedMd, setCopiedMd] = useState(false);

  const { room, stats, questions } = exportData;
  const safeTopic = (room.topic || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);

  const resolvedQuestions = questions.filter((q) => q.status === 'resolved');
  const unresolvedQuestions = questions.filter((q) => q.status !== 'resolved');

  const displayedQuestions =
    filterTab === 'resolved'
      ? resolvedQuestions
      : filterTab === 'unresolved'
      ? unresolvedQuestions
      : questions;

  const resolvedPercent =
    stats.totalQuestions > 0
      ? Math.round((stats.resolvedCount / stats.totalQuestions) * 100)
      : 0;

  // Download client-side CSV
  const handleDownloadCSV = () => {
    const sanitizeCell = (val: string): string => {
      let clean = (val || '').replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(clean)) {
        clean = "'" + clean;
      }
      return `"${clean}"`;
    };

    const headers = ['ID', 'Question', 'Slide / Section', 'Upvotes', 'Pinned', 'Status', 'Created Time', 'Resolved Time'];
    const rows = questions.map((q) => {
      const createdStr = new Date(q.createdAt).toISOString();
      const resolvedStr = q.resolvedAt ? new Date(q.resolvedAt).toISOString() : '';
      const slideStr = q.slideTag || 'None';
      return [
        q.id,
        sanitizeCell(q.text),
        sanitizeCell(slideStr),
        q.upvotes,
        q.isPinned ? 'Yes' : 'No',
        q.status,
        createdStr,
        resolvedStr,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${safeTopic}_${room.code}_Archive.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download client-side Markdown
  const handleDownloadMD = () => {
    const dateStr = new Date(room.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let md = `# Lecture Q&A Archive: ${room.topic}\n\n`;
    md += `**Date:** ${dateStr}  \n`;
    md += `**Room Code:** \`${room.code}\`  \n`;
    md += `**Total Questions:** ${stats.totalQuestions}  \n`;
    md += `**Total Upvotes:** ${stats.totalUpvotes}  \n`;
    md += `**Answered:** ${stats.resolvedCount} / ${stats.totalQuestions} (${resolvedPercent}%)\n\n`;

    md += `## 🎙️ Answered Questions (${resolvedQuestions.length})\n\n`;
    resolvedQuestions.forEach((q, idx) => {
      const slide = q.slideTag ? ` \`[${q.slideTag}]\`` : '';
      md += `${idx + 1}. **${q.text}**${slide}\n`;
      md += `   - Upvotes: ${q.upvotes} | Submitted: ${new Date(q.createdAt).toLocaleTimeString()}\n\n`;
    });

    md += `## 📋 Unaddressed Questions (${unresolvedQuestions.length})\n\n`;
    unresolvedQuestions.forEach((q, idx) => {
      const slide = q.slideTag ? ` \`[${q.slideTag}]\`` : '';
      md += `${idx + 1}. ${q.text}${slide}\n`;
      md += `   - Upvotes: ${q.upvotes} | Status: ${q.status}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${safeTopic}_${room.code}_Summary.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    try {
      let md = `# Lecture Q&A Summary: ${room.topic} (Room ${room.code})\n\n`;
      questions.forEach((q, i) => {
        md += `${i + 1}. ${q.text} (${q.upvotes} upvotes) - ${q.status}\n`;
      });
      await navigator.clipboard.writeText(md);
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-12">
      {/* Top Header with Back to Main Screen Button */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBackToMain}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700 active:scale-95 flex-shrink-0"
              title="Return to Main Screen"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-400" />
              <span>Back to Main</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono font-bold border border-slate-700">
                  {room.code}
                </span>
                <span className="text-amber-400 font-medium hidden sm:inline">📦 Archived Read-Only</span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                {room.topic}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-6 space-y-6 flex-1">
        {/* Banner Alert */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-200">Past Classroom Archive</h3>
              <p className="text-xs text-amber-300/80">
                You are viewing the archived Q&A summary for this class session.
              </p>
            </div>
          </div>

          {onReopenRoom && (
            <button
              onClick={() => onReopenRoom(room.code)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold rounded-xl border border-amber-500/30 transition active:scale-95 flex-shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reopen Session</span>
            </button>
          )}
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1">
              <MessageSquare className="w-3.5 h-3.5" /> Total Doubts
            </div>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-100">{stats.totalQuestions}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-indigo-400 text-xs mb-1">
              <ThumbsUp className="w-3.5 h-3.5" /> Total Upvotes
            </div>
            <span className="text-2xl sm:text-3xl font-extrabold text-indigo-400">{stats.totalUpvotes}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
            </div>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{resolvedPercent}%</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1">
              <Clock className="w-3.5 h-3.5" /> Duration
            </div>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-200">{stats.durationMinutes}m</span>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                filterTab === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Questions ({questions.length})
            </button>

            <button
              onClick={() => setFilterTab('resolved')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterTab === 'resolved'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Answered ({resolvedQuestions.length})</span>
            </button>

            <button
              onClick={() => setFilterTab('unresolved')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterTab === 'unresolved'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Unaddressed ({unresolvedQuestions.length})</span>
            </button>
          </div>

          <button
            onClick={handleCopyMarkdown}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs rounded-xl transition"
          >
            {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedMd ? 'Copied!' : 'Copy Summary'}</span>
          </button>
        </div>

        {/* Questions Feed */}
        <div className="space-y-3">
          {displayedQuestions.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
              <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No questions in this section</p>
            </div>
          ) : (
            displayedQuestions.map((q, idx) => (
              <div
                key={q.id}
                className={`p-4 rounded-2xl border transition ${
                  q.status === 'resolved'
                    ? 'bg-slate-900/50 border-emerald-900/30'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-mono text-slate-500 font-bold">#{idx + 1}</span>
                      {q.isPinned && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                          <Pin className="w-3 h-3" /> Pinned
                        </span>
                      )}
                      {q.status === 'resolved' ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Answered
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                          Unanswered
                        </span>
                      )}
                      {q.slideTag && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-medium border border-slate-700">
                          🏷️ {q.slideTag}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-slate-100">{q.text}</p>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>Asked at {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {q.resolvedAt && (
                        <span className="text-emerald-400/80">
                          &bull; Answered at {new Date(q.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-indigo-400 font-bold text-xs">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{q.upvotes}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Return Button */}
        <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onBackToMain}
            className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-2xl border border-slate-700 transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Return to Main Screen</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Download CSV</span>
            </button>
            <button
              onClick={handleDownloadMD}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition"
            >
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>Download Markdown</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
export default ArchiveViewer;
