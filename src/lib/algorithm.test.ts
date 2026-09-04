import { describe, expect, it } from 'vitest';
import type { DrawConfiguration } from '../types/draw';
import { participantDigest, randomChunks, runDraw } from './algorithm';

const HASH = `0x${'0123456789abcdef'.repeat(4)}`;
const configuration: DrawConfiguration = {
  participantSpec: { kind: 'range', start: 1, end: 30 },
  prizes: [{ id: 'a', name: '一等奖', count: 2 }, { id: 'b', name: '二等奖', count: 12 }],
};

describe('CHAIN_DRAW_V1', () => {
  it('uses ten chunks per seed then continues with a SHA-256 hash chain', () => {
    const chunks = randomChunks(HASH);
    const first = Array.from({ length: 11 }, () => chunks.next().value);
    expect(first.slice(0, 10)).toEqual(['012345', '6789ab', 'cdef01', '234567', '89abcd', 'ef0123', '456789', 'abcdef', '012345', '6789ab']);
    expect(first[10]).toBe('4884fd');
  });

  it('is deterministic, supports more than ten winners, and never repeats', () => {
    const first = runDraw(configuration, HASH);
    const second = runDraw(configuration, HASH);
    expect(first).toEqual(second);
    expect(first.winners).toHaveLength(14);
    expect(new Set(first.winners.map(({ participantId }) => participantId)).size).toBe(14);
    expect(first.winners.slice(0, 2).every(({ prize }) => prize === '一等奖')).toBe(true);
  });

  it('changes the participant commitment when order changes', () => {
    const a: DrawConfiguration = { participantSpec: { kind: 'list', participants: [{ id: '1' }, { id: '2' }] }, prizes: configuration.prizes };
    const b: DrawConfiguration = { participantSpec: { kind: 'list', participants: [{ id: '2' }, { id: '1' }] }, prizes: configuration.prizes };
    expect(participantDigest(a)).not.toBe(participantDigest(b));
  });
});
