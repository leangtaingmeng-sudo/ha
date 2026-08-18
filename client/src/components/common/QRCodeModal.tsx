import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, ExternalLink, QrCode } from 'lucide-react';

interface QRCodeModalProps {
  roomCode: string;
  topic: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ roomCode, topic, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const joinUrl = `${window.location.origin}/?room=${roomCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-full transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mb-3">
          <QrCode className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-1">{topic}</h3>
        <p className="text-sm text-slate-400 mb-6">Scan with your phone camera or enter room code to ask questions anonymously</p>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl shadow-inner mb-6">
          <QRCodeSVG
            value={joinUrl}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Room Code Badge */}
        <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4 flex items-center justify-between">
          <div className="text-left">
            <span className="text-xs text-slate-400 font-medium block uppercase tracking-wider">Room Code</span>
            <span className="text-2xl font-extrabold tracking-widest text-indigo-400 font-mono">{roomCode}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition active:scale-95 shadow-md shadow-indigo-600/20"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy Link
              </>
            )}
          </button>
        </div>

        {/* Join URL Display */}
        <div className="text-xs text-slate-400 truncate max-w-full flex items-center gap-1">
          <ExternalLink className="w-3.5 h-3.5 inline text-slate-400" />
          <span className="truncate">{joinUrl}</span>
        </div>
      </div>
    </div>
  );
};
