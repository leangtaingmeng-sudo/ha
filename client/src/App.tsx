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

  // Auto-reconnect to previous session on page refresh (checking URL query + localStorage)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room')?.trim().toUpperCase();
    const urlRole = params.get('role')?.toLowerCase() === 'host' ? 'host' : undefined;

    const saved = getSavedActiveSession();

    const targetRoom = urlRoom || saved?.roomCode;
    const targetRole: 'host' | 'student' = urlRole || saved?.role || 'student';
    const targetTopic = saved?.topic;

    if (!targetRoom) {
      setIsRestoringSession(false);
      return;
    }

    const tryJoin = () => {
      socket.emit(
        'join-room',
        {
          roomCode: targetRoom,
          sessionId,
          role: targetRole,
        },
        (res) => {
          if (res.success && res.room && res.questions) {
            const hostFlag = res.isHost ?? (targetRole === 'host');
            setCurrentRoom(res.room);
            setQuestions(res.questions);
            setIsHost(hostFlag);
            saveActiveSession(res.room.code, hostFlag ? 'host' : 'student', res.room.topic);
            addRecentRoom(res.room.code, res.room.topic, hostFlag ? 'host' : 'student');
            window.history.replaceState(
              {},
              '',
              `?room=${res.room.code}${hostFlag ? '&role=host' : ''}`
            );
            setIsRestoringSession(false);
          } else {
            // If Professor was hosting and room was cleared from server restart, restore it automatically!
            if (targetRole === 'host') {
              socket.emit(
                'restore-room',
                {
                  roomCode: targetRoom,
                  topic: targetTopic,
                  sessionId,
                },
                (restoreRes) => {
                  setIsRestoringSession(false);
                  if (restoreRes.success && restoreRes.room) {
                    setCurrentRoom(restoreRes.room);
                    setQuestions(restoreRes.questions || []);
                    setIsHost(true);
                    saveActiveSession(restoreRes.room.code, 'host', restoreRes.room.topic);
                    addRecentRoom(restoreRes.room.code, restoreRes.room.topic, 'host');
                    window.history.replaceState(
                      {},
                      '',
                      `?room=${restoreRes.room.code}&role=host`
                    );
                  } else {
                    clearActiveSession();
                    window.history.replaceState({}, '', window.location.pathname);
                  }
                }
              );
            } else {
              setIsRestoringSession(false);
              clearActiveSession();
              window.history.replaceState({}, '', window.location.pathname);
            }
          }
        }
      );
    };

    tryJoin();

    // Fallback safety timeout so user is never permanently stuck
    const safetyTimer = setTimeout(() => {
      setIsRestoringSession(false);
    }, 5000);

    return () => clearTimeout(safetyTimer);
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
    saveActiveSession(data.room.code, data.isHost ? 'host' : 'student', data.room.topic);
    addRecentRoom(data.room.code, data.room.topic, data.isHost ? 'host' : 'student');
    window.history.replaceState(
      {},
      '',
      `?room=${data.room.code}${data.isHost ? '&role=host' : ''}`
    );
  };

  const handleLeaveRoom = () => {
    clearActiveSession();
    setCurrentRoom(null);
    setQuestions([]);
    setIsHost(false);
    setEndedExportData(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleReturnToMainScreen = () => {
    setIsExportModalOpen(false);
    handleLeaveRoom();
  };

  // Restoring state loader
  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Restoring classroom HUD...</span>
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
          onNewSession={handleReturnToMainScreen}
        />
        {endedExportData && (
          <ExportModal
            exportData={endedExportData}
            isOpen={isExportModalOpen}
            onClose={handleReturnToMainScreen}
            onNewSession={handleReturnToMainScreen}
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
          onClose={handleReturnToMainScreen}
          onNewSession={handleReturnToMainScreen}
        />
      )}
    </>
  );
};
export default App;
