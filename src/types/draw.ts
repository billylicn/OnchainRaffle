export const ALGORITHM_VERSION = 'CHAIN_DRAW_V1' as const;

export type Participant = {
  id: string;
  name?: string;
};

export type ParticipantGridRow = {
  id: string;
  name: string;
};

export type Prize = {
  id: string;
  name: string;
  count: number;
};

export type ListParticipantSpec = {
  kind: 'list';
  participants: Participant[];
};

export type RangeParticipantSpec = {
  kind: 'range';
  start: number;
  end: number;
};

export type ParticipantSpec = ListParticipantSpec | RangeParticipantSpec;

export type DrawConfiguration = {
  participantSpec: ParticipantSpec;
  prizes: Prize[];
};

export type DrawDraft = {
  mode: 'list' | 'range';
  participantRows: ParticipantGridRow[];
  rangeStart: string;
  rangeEnd: string;
  prizes: Prize[];
};

export type ValidationIssue = {
  row?: number;
  message: string;
};

export type Winner = {
  prize: string;
  prizeIndex: number;
  participantId: string;
};

export type DrawTraceEvent = {
  slot: number;
  prize: string;
  chunk: string;
  value: number;
  remaining: number;
  limit: number;
  accepted: boolean;
  selectedIndex?: number;
  participantId?: string;
};

export type LockedDraw = {
  algorithmVersion: typeof ALGORITHM_VERSION;
  chainId: 1;
  configuration: DrawConfiguration;
  participantDigest: string;
  headAtLock: number;
  targetBlock: number;
  confirmationBlock: number;
  lockedAt: string;
};

export type ConfirmedDraw = LockedDraw & {
  blockHash: string;
  targetBlockTimestamp: number;
  confirmedHead: number;
  rpcUrl: string;
};

export type DrawResult = ConfirmedDraw & {
  winners: Winner[];
  trace: DrawTraceEvent[];
  completedAt: string;
};

export const DEFAULT_DRAFT: DrawDraft = {
  mode: 'list',
  participantRows: Array.from({ length: 10 }, () => ({ id: '', name: '' })),
  rangeStart: '1',
  rangeEnd: '100',
  prizes: [{ id: 'prize-1', name: '一等奖', count: 1 }],
};
