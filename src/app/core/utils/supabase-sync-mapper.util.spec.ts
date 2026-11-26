import { describe, expect, it } from 'vitest';
import {
  CaseStudy,
  ExamAttempt,
  Flashcard,
  GamificationProfile,
  Question,
  StudyBlock,
  StudySession,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';
import {
  blockToRow,
  caseStudyToRow,
  examAttemptToRow,
  flashcardToRow,
  gamificationToRow,
  isRemoteNewer,
  questionToRow,
  rowToBlock,
  rowToCaseStudy,
  rowToExamAttempt,
  rowToFlashcard,
  rowToGamification,
  rowToQuestion,
  rowToStudySession,
  rowToTopic,
  rowToWeeklyPlanItem,
  studySessionToRow,
  topicToRow,
  weeklyPlanItemToRow,
} from './supabase-sync-mapper.util';

describe('supabase-sync-mapper.util', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const now = '2026-11-26T12:00:00.000Z';

  it('evaluates isRemoteNewer with pure LWW semantics', () => {
    expect(isRemoteNewer(undefined, now)).toBe(true);
    expect(isRemoteNewer(now, undefined)).toBe(false);
    expect(isRemoteNewer('2026-11-26T10:00:00.000Z', '2026-11-26T12:00:00.000Z')).toBe(true);
    expect(isRemoteNewer('2026-11-26T12:00:00.000Z', '2026-11-26T12:00:00.000Z')).toBe(true);
    expect(isRemoteNewer('2026-11-26T14:00:00.000Z', '2026-11-26T12:00:00.000Z')).toBe(false);
  });

  it('round-trips StudyBlock', () => {
    const block: StudyBlock = {
      id: 'block-1',
      code: 'RED',
      title: 'Redes',
      shortTitle: 'Redes',
      description: 'TCP/IP',
      color: '#0891b2',
      icon: 'lan',
      order: 1,
      updatedAt: now,
    };
    const row = blockToRow(userId, block, now);
    expect(row.user_id).toBe(userId);
    expect(row.deleted_at).toBeNull();
    expect(rowToBlock(row)).toEqual(block);
  });

  it('round-trips Topic', () => {
    const topic: Topic = {
      id: 'topic-1',
      blockId: 'block-1',
      order: 0,
      title: 'Modelo OSI',
      status: 'outlined',
      roundCount: 2,
      tags: ['redes', 'capas'],
      contentJson: { type: 'doc', content: [] },
      plainText: 'Capas OSI',
      customOutlineMd: '# OSI',
      createdAt: now,
      updatedAt: now,
      lastReviewedAt: now,
    };
    const row = topicToRow(userId, topic);
    expect(rowToTopic(row)).toEqual(topic);
  });

  it('round-trips StudySession and WeeklyPlanItem', () => {
    const session: StudySession = {
      id: 'sess-1',
      topicId: 'topic-1',
      blockId: 'block-1',
      startedAt: now,
      endedAt: now,
      durationMinutes: 25,
      type: 'reading',
      notes: 'Pomodoro 1',
      updatedAt: now,
    };
    expect(rowToStudySession(studySessionToRow(userId, session, now))).toEqual(session);

    const plan: WeeklyPlanItem = {
      id: 'plan-1',
      weekStartDate: '2026-11-23',
      dayOfWeek: 4,
      topicId: 'topic-1',
      blockId: 'block-1',
      order: 0,
      completed: true,
      completedAt: now,
      targetPomodoros: 2,
      updatedAt: now,
    };
    expect(rowToWeeklyPlanItem(weeklyPlanItemToRow(userId, plan, now))).toEqual(plan);
  });

  it('round-trips CaseStudy, Question, ExamAttempt, Flashcard and GamificationProfile', () => {
    const cs: CaseStudy = {
      id: 'cs-1',
      blockId: 'block-1',
      title: 'Supuesto Red',
      statement: 'Enunciado',
      source: '2025',
      tags: ['practico'],
      createdAt: now,
      updatedAt: now,
    };
    expect(rowToCaseStudy(caseStudyToRow(userId, cs))).toEqual(cs);

    const question: Question = {
      id: 'q-1',
      blockId: 'block-1',
      topicId: 'topic-1',
      caseStudyId: 'cs-1',
      prompt: '¿Puerto HTTPS?',
      options: ['80', '443', '22', '53'],
      correctIndex: 1,
      explanation: 'TLS usa 443',
      reference: 'RFC',
      source: 'Manual',
      tags: ['puertos'],
      flagged: true,
      stats: { attempts: 2, correct: 2, lastAnsweredAt: now, lastResult: 'correct' },
      createdAt: now,
      updatedAt: now,
    };
    expect(rowToQuestion(questionToRow(userId, question))).toEqual(question);

    const attempt: ExamAttempt = {
      id: 'ea-1',
      title: 'Simulacro',
      date: now,
      mode: 'simulation',
      penaltyRatio: 0.33,
      caseStudyId: undefined,
      answers: [
        {
          questionId: 'q-1',
          blockId: 'block-1',
          topicId: 'topic-1',
          selectedIndex: 1,
          correctIndex: 1,
          isCorrect: true,
        },
      ],
      correctCount: 1,
      wrongCount: 0,
      blankCount: 0,
      netScore: 1,
      maxScore: 1,
      scoreOn10: 10,
      durationSec: 30,
      updatedAt: now,
    };
    expect(rowToExamAttempt(examAttemptToRow(userId, attempt, now))).toEqual(attempt);

    const flashcard: Flashcard = {
      id: 'fc-1',
      blockId: 'block-1',
      topicId: 'topic-1',
      front: 'HTTP',
      back: 'Hypertext Transfer Protocol',
      hint: 'Web',
      tags: ['siglas'],
      srs: {
        intervalDays: 6,
        easeFactor: 2.5,
        repetitions: 2,
        lapses: 0,
        dueDate: '2026-12-02',
        lastReviewedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
    expect(rowToFlashcard(flashcardToRow(userId, flashcard))).toEqual(flashcard);

    const gamification: GamificationProfile = {
      id: 'local-user',
      xp: 320,
      streakDays: 5,
      longestStreakDays: 10,
      streakFreezes: 2,
      maxStreakFreezes: 3,
      lastActiveDate: '2026-11-26',
      activeDates: ['2026-11-25', '2026-11-26'],
      freezeUsedDates: [],
      weeklyRestDays: [0],
      claimedMissionIds: ['m-1'],
      updatedAt: now,
    };
    expect(rowToGamification(gamificationToRow(userId, gamification))).toEqual(gamification);
  });
});
