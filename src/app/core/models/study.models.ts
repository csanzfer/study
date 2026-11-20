export type TaiBlockId = 'B1' | 'B2' | 'B3' | 'B4';

export type TopicStatus =
  | 'pending'
  | 'first_round'
  | 'outlined'
  | 'memorizing'
  | 'mastered';

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  pending: 'Sin empezar',
  first_round: '1ª vuelta',
  outlined: 'Esquematizado',
  memorizing: 'Memorizando',
  mastered: 'Dominado',
};

export interface TaiBlock {
  id: TaiBlockId;
  code: string;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  icon: string;
  order: number;
}

export interface Topic {
  id: string;
  blockId: TaiBlockId;
  order: number;
  title: string;
  status: TopicStatus;
  roundCount: number;
  tags: string[];
  contentJson: unknown;
  plainText: string;
  customOutlineMd?: string;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}

export interface CreateTopicInput {
  blockId: TaiBlockId;
  title: string;
  tags?: string[];
  status?: TopicStatus;
  contentJson?: unknown;
  plainText?: string;
}

export interface BackupPayload {
  schemaVersion: 1;
  appName: 'tai-study';
  exportedAt: string;
  blocks: TaiBlock[];
  topics: Topic[];
}
