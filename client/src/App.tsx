import React, { useState, useEffect } from 'react';
import { socket } from './utils/socket.js';
import { getOrCreateSessionId } from './utils/session.js';
import { Room, Question, SessionExportData } from '../shared/types.js';
import { LandingJoin } from './components/LandingJoin.js';
import { StudentView } from './components/student/StudentView.js';
import { HostHUD } from './components/host/HostHUD.js';
import { ExportModal } from './components/common/ExportModal.js';

export const App: React.FC = () => {
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [endedExportData, setEndedExportData] = useState<SessionExportData | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    setQuestions([]);
    setIsHost(false);
    setEndedExportData(null);
    // Clear URL query param without full page reload
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleStartNewSession = () => {
    setIsExportModalOpen(false);
    handleLeaveRoom();
  };

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
