import React, { useState } from 'react';
import { SessionExportData } from '../../../shared/types.js';
import { X, Download, FileText, Check, Copy, Sparkles, CheckCircle2, MessageSquare, ThumbsUp } from 'lucide-react';

interface ExportModalProps {
  exportData: SessionExportData;
  isOpen: boolean;
  onClose: () => void;
  onNewSession?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  exportData,
  isOpen,
  onClose,
  onNewSession,
}) => {
  const [copiedMd, setCopiedMd] = useState(false);

  if (!isOpen) return null;

  const { room, stats, questions } = exportData;

  const handleDownloadCSV = () => {
    window.location.href = `/api/rooms/${room.code}/export/csv`;
  };

  const handleDownloadMD = () => {
    window.location.href = `/api/rooms/${room.code}/export/md`;
  };

  const handleCopyMarkdown = async () => {
    try {
      const res = await fetch(`/api/rooms/${room.code}/export/md`);
      const mdText = await res.text();
      await navigator.clipboard.writeText(mdText);
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2500);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  const resolvedPercent = stats.totalQuestions > 0
    ? Math.round((stats.resolvedCount / stats.totalQuestions) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-full transition"
          aria-label="Close export dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-100">Session Completed</h3>
            <p className="text-xs text-slate-400">{room.topic} &bull; Room <span className="font-mono font-semibold text-slate-300">{room.code}</span></p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 my-6">
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
              <MessageSquare className="w-3.5 h-3.5" /> Doubts Asked
            </div>
            <span className="text-2xl font-extrabold text-slate-100">{stats.totalQuestions}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-indigo-400 text-xs mb-1">
              <ThumbsUp className="w-3.5 h-3.5" /> Total Upvotes
            </div>
            <span className="text-2xl font-extrabold text-indigo-400">{stats.totalUpvotes}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Resolved
            </div>
            <span className="text-2xl font-extrabold text-emerald-400">{resolvedPercent}%</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleDownloadCSV}
            className="w-full flex items-center justify-between p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-2xl transition group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-100 text-sm">Download Spreadsheet (CSV)</div>
                <div className="text-xs text-slate-400">Contains full table of questions, slide tags, upvotes, & timestamps</div>
              </div>
            </div>
            <Download className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition" />
          </button>

          <button
            onClick={handleDownloadMD}
            className="w-full flex items-center justify-between p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-2xl transition group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-100 text-sm">Download Markdown Summary (.md)</div>
                <div className="text-xs text-slate-400">Formatted documentation ready for Notion, Canvas, or GitHub</div>
              </div>
            </div>
            <Download className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition" />
          </button>

          <button
            onClick={handleCopyMarkdown}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition active:scale-98"
          >
            {copiedMd ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">Copied Summary to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copy Markdown Summary to Clipboard</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
          <span className="text-xs text-slate-400">
            {questions.length} total questions logged
          </span>
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition active:scale-95 shadow-md shadow-indigo-600/20"
            >
              Start New Class Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
