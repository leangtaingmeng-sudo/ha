import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../server/store.js';

describe('PulseQ MemoryStore Engine', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('FR-1.1: Creates a room with a 6-character alphanumeric code and topic', () => {
    const topic = 'Quantum Computing 101';
    const room = store.createRoom(topic);

    expect(room.code).toBeDefined();
    expect(room.code.length).toBe(6);
    expect(/^[A-Z0-9]{6}$/.test(room.code)).toBe(true);
    expect(room.topic).toBe(topic);
    expect(room.status).toBe('active');
    expect(room.participantCount).toBe(0);
  });

  it('FR-1.2: Manages participants and tracking per room', () => {
    const room = store.createRoom('Linear Algebra');
    const result1 = store.joinSocket('socket_1', room.code, 'session_student_1', 'student');
    expect(result1).not.toBeNull();
    expect(result1?.room.participantCount).toBe(1);

    const result2 = store.joinSocket('socket_2', room.code, 'session_student_2', 'student');
    expect(result2?.room.participantCount).toBe(2);

    const leaveResult = store.leaveSocket('socket_1');
    expect(leaveResult?.participantCount).toBe(1);
  });

  it('FR-2.1: Submits questions with 280-char cap and optional slide tag', () => {
    const room = store.createRoom('Calculus IV');
    const question = store.addQuestion(
      room.code,
      'Why does the divergence theorem apply here?',
      'Slide 14',
      'session_user_1'
    );

    expect(question).not.toBeNull();
    expect(question?.text).toBe('Why does the divergence theorem apply here?');
    expect(question?.slideTag).toBe('Slide 14');
    expect(question?.upvotes).toBe(0);
    expect(question?.status).toBe('pending');
    expect(question?.isPinned).toBe(false);
  });

  it('FR-2.2: Enforces single upvote per session ID with toggle capability', () => {
    const room = store.createRoom('Algorithms');
    const question = store.addQuestion(room.code, 'What is the time complexity of BFS?', undefined, 'user_1');
    expect(question).not.toBeNull();

    // 1st upvote from session_A
    const vote1 = store.upvoteQuestion(room.code, question!.id, 'session_A');
    expect(vote1?.hasUpvoted).toBe(true);
    expect(vote1?.question.upvotes).toBe(1);

    // 2nd upvote from session_B
    const vote2 = store.upvoteQuestion(room.code, question!.id, 'session_B');
    expect(vote2?.hasUpvoted).toBe(true);
    expect(vote2?.question.upvotes).toBe(2);

    // Repeated upvote from session_A (toggle unvote)
    const vote3 = store.upvoteQuestion(room.code, question!.id, 'session_A');
    expect(vote3?.hasUpvoted).toBe(false);
    expect(vote3?.question.upvotes).toBe(1);
  });

  it('FR-3.1: Sorts priority queue with highest upvoted and pinned questions first', () => {
    const room = store.createRoom('Data Structures');
    const q1 = store.addQuestion(room.code, 'Question 1', 'Slide 1', 'u1')!;
    const q2 = store.addQuestion(room.code, 'Question 2', 'Slide 2', 'u2')!;
    const q3 = store.addQuestion(room.code, 'Question 3', 'Slide 3', 'u3')!;

    // Give q2 3 upvotes, q3 1 upvote, q1 0 upvotes
    store.upvoteQuestion(room.code, q2.id, 'voter1');
    store.upvoteQuestion(room.code, q2.id, 'voter2');
    store.upvoteQuestion(room.code, q2.id, 'voter3');
    store.upvoteQuestion(room.code, q3.id, 'voter4');

    let sorted = store.getQuestions(room.code);
    expect(sorted[0].id).toBe(q2.id);
    expect(sorted[0].upvotes).toBe(3);
    expect(sorted[1].id).toBe(q3.id);
    expect(sorted[1].upvotes).toBe(1);
    expect(sorted[2].id).toBe(q1.id);
    expect(sorted[2].upvotes).toBe(0);

    // Pin q1 (which has 0 upvotes) -> it must move to #1 position!
    store.togglePinQuestion(room.code, q1.id);
    sorted = store.getQuestions(room.code);
    expect(sorted[0].id).toBe(q1.id);
    expect(sorted[0].isPinned).toBe(true);
    expect(sorted[1].id).toBe(q2.id);
  });

  it('FR-3.2: Handles Question Status Lifecycle (Pending -> Answering -> Resolved)', () => {
    const room = store.createRoom('Physics II');
    const q1 = store.addQuestion(room.code, 'Question 1', 'Slide 1', 'u1')!;
    const q2 = store.addQuestion(room.code, 'Question 2', 'Slide 2', 'u2')!;

    // Start answering Q1
    const ans1 = store.updateQuestionStatus(room.code, q1.id, 'answering');
    expect(ans1?.updatedQuestion.status).toBe('answering');
    expect(ans1?.updatedQuestion.answeringAt).toBeDefined();

    // Start answering Q2 -> Q1 automatically demotes back to pending
    const ans2 = store.updateQuestionStatus(room.code, q2.id, 'answering');
    expect(ans2?.updatedQuestion.status).toBe('answering');
    expect(ans2?.previousAnswering?.id).toBe(q1.id);
    expect(ans2?.previousAnswering?.status).toBe('pending');

    // Mark Q2 as resolved
    const res2 = store.updateQuestionStatus(room.code, q2.id, 'resolved');
    expect(res2?.updatedQuestion.status).toBe('resolved');
    expect(res2?.updatedQuestion.resolvedAt).toBeDefined();
  });

  it('FR-4: Generates accurate CSV and Markdown exports', () => {
    const room = store.createRoom('Organic Chemistry');
    const q1 = store.addQuestion(room.code, 'What is Markovnikov rule?', 'Slide 8', 'u1')!;
    store.upvoteQuestion(room.code, q1.id, 'voter1');
    store.togglePinQuestion(room.code, q1.id);
    store.updateQuestionStatus(room.code, q1.id, 'resolved');

    const csv = store.generateCSV(room.code);
    expect(csv).toContain('What is Markovnikov rule?');
    expect(csv).toContain('Slide 8');
    expect(csv).toContain('Yes'); // Pinned column
    expect(csv).toContain('resolved');

    const md = store.generateMarkdown(room.code);
    expect(md).toContain('# Lecture Q&A Summary: Organic Chemistry');
    expect(md).toContain('What is Markovnikov rule?');
    expect(md).toContain('`[Slide 8]`');
    expect(md).toContain('📌 *(Pinned)*');
  });
});
