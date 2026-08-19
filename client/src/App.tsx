import React, { useState, useEffect } from 'react';
import { socket } from './utils/socket.js';
import {
  getOrCreateSessionId,
  saveActiveSession,
  getSavedActiveSession,
  clearActiveSession,
  addRecentRoom
} from './utils/session.js';
import { Room, Question, SessionExportData } from '../shared/types.js';
import { LandingJoin } from './components/LandingJoin.js';
import { StudentView } from './components/student/StudentView.js';
import { HostHUD } from './components/host/HostHUD.js';
import { ExportModal } from './components/common/ExportModal.js';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [endedExportData, setEndedExportData] = useState<SessionExportData | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Auto-reconnect to previous session on page refresh
  useEffect(() => {
    const saved = getSavedActiveSession();
    if (!saved) {
      setIsRestoringSession(false);
      return;
    }

    const tryReconnect = () => {
      socket.emit(
        'join-room',
        {
          roomCode: saved.roomCode,
          sessionId,
          role: saved.role,
        },
        (res) => {
          setIsRestoringSession(false);
          if (res.success && res.room && res.questions) {
            setCurrentRoom(res.room);
            setQuestions(res.questions);
            setIsHost(res.isHost ?? (saved.role === 'host'));
            addRecentRoom(res.room.code, res.room.topic, res.isHost ? 'host' : 'student');
          } else {
            // Room expired or deleted
            clearActiveSession();
          }
        }
      );
    };

    if (socket.connected) {
      tryReconnect();
    } else {
      socket.once('connect', tryReconnect);
      const timeout = setTimeout(() => {
        setIsRestoringSession(false);
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [sessionId]);

  useEffect(() => {
    // Socket real-time listeners
    const handleRoomUpdated = (updatedRoom: Room) => {
      setCurrentRoom(updatedRoom);
    };

    const handleParticipantCount = (count: number) => {
      setCurrentRoom((prev) => (prev ? { ...prev, participantCount: count } : null));
    };

    const handleQuestionAdded = (newQuestion: Question) => {
      setQuestions((prev) => {
        if (prev.some((q) => q.id === newQuestion.id)) return prev;
        return [...prev, newQuestion];
      });
    };

    const handleQuestionUpdated = (updatedQuestion: Question) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
      );
    };

    const handleQuestionDeleted = ({ questionId }: { questionId: string }) => {
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    };

    const handleQuestionsSynced = (syncedQuestions: Question[]) => {
      setQuestions(syncedQuestions);
    };

    const handleSessionEnded = ({ exportData }: { roomCode: string; exportData: SessionExportData }) => {
      setCurrentRoom((prev) => (prev ? { ...prev, status: 'ended' } : null));
      setEndedExportData(exportData);
      setIsExportModalOpen(true);
      clearActiveSession();
    };

    socket.on('room-updated', handleRoomUpdated);
    socket.on('participant-count', handleParticipantCount);
    socket.on('question-added', handleQuestionAdded);
    socket.on('question-updated', handleQuestionUpdated);
    socket.on('question-deleted', handleQuestionDeleted);
    socket.on('questions-synced', handleQuestionsSynced);
    socket.on('session-ended', handleSessionEnded);

    return () => {
      socket.off('room-updated', handleRoomUpdated);
      socket.off('participant-count', handleParticipantCount);
      socket.off('question-added', handleQuestionAdded);
      socket.off('question-updated', handleQuestionUpdated);
      socket.off('question-deleted', handleQuestionDeleted);
      socket.off('questions-synced', handleQuestionsSynced);
      socket.off('session-ended', handleSessionEnded);
    };
  }, []);

  const handleJoined = (data: { room: Room; questions: Question[]; isHost: boolean }) => {
    setCurrentRoom(data.room);
    setQuestions(data.questions);
    setIsHost(data.isHost);
    setEndedExportData(null);
    saveActiveSession(data.room.code, data.isHost ? 'host' : 'student');
    addRecentRoom(data.room.code, data.room.topic, data.isHost ? 'host' : 'student');
  };

  const handleLeaveRoom = () => {
    clearActiveSession();
    setCurrentRoom(null);
    setQuestions([]);
    setIsHost(false);
    setEndedExportData(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleStartNewSession = () => {
    setIsExportModalOpen(false);
    handleLeaveRoom();
  };

  // Restoring state loader
  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Connecting to PulseQ...</span>
      </div>
    );
  }

  // If not connected to a room, show Landing & Join view
  if (!currentRoom) {
    return <LandingJoin sessionId={sessionId} onJoined={handleJoined} />;
  }

  // Instructor HUD View
  if (isHost) {
    return (
      <>
        <HostHUD
          room={currentRoom}
          questions={questions}
          onEndSession={(exportData) => {
            setEndedExportData(exportData);
            setIsExportModalOpen(true);
          }}
          onNewSession={handleStartNewSession}
        />
        {endedExportData && (
          <ExportModal
            exportData={endedExportData}
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            onNewSession={handleStartNewSession}
          />
        )}
      </>
    );
  }

  // Student View
  return (
    <>
      <StudentView
        room={currentRoom}
        questions={questions}
        sessionId={sessionId}
        onLeaveRoom={handleLeaveRoom}
      />
      {endedExportData && (
        <ExportModal
          exportData={endedExportData}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onNewSession={handleStartNewSession}
        />
      )}
    </>
  );
};
export default App;
