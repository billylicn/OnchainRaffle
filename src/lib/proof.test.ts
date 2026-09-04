import { describe, expect, it } from 'vitest';
import type { DrawResult } from '../types/draw';
import { ALGORITHM_VERSION } from '../types/draw';
import { participantDigest, runDraw } from './algorithm';
import { assertPublicProof, createFullProof, decodeProof, encodeProof, PROOF_VERSION, selectQrProof, verifyFullProof } from './proof';

const configuration = {
  participantSpec: { kind: 'list' as const, participants: [{ id: '1', name: '张三' }, { id: '2', name: '李四' }, { id: '3' }] },
  prizes: [{ id: 'p1', name: '一等奖', count: 1 }, { id: 'p2', name: '二等奖', count: 1 }],
};
const blockHash = `0x${'ab'.repeat(32)}`;
const computed = runDraw(configuration, blockHash);
const result: DrawResult = {
  algorithmVersion: ALGORITHM_VERSION, chainId: 1, configuration,
  participantDigest: participantDigest(configuration), headAtLock: 100, targetBlock: 102,
  confirmationBlock: 104, lockedAt: '2026-09-04T00:00:00.000Z', blockHash,
  targetBlockTimestamp: 1_788_480_000, confirmedHead: 104, rpcUrl: 'https://example.test', ...computed, completedAt: '2026-09-04T00:01:00.000Z',
};

describe('DrawProofV3', () => {
  it('stores only compact reproducible inputs and round-trips compression', () => {
    const proof = createFullProof(result);
    const serialized = JSON.stringify(proof);
    expect(proof.proofVersion).toBe(PROOF_VERSION);
    expect(proof.participantMode).toBe('list');
    expect(proof.participantCount).toBe(3);
    expect(proof).not.toHaveProperty('participants');
    expect(proof).not.toHaveProperty('winners');
    expect(proof).not.toHaveProperty('lockedAt');
    expect(proof).not.toHaveProperty('completedAt');
    expect(serialized).not.toContain('张三');
    expect(decodeProof(encodeProof(proof))).toEqual(proof);
  });

  it('reconstructs continuous ids and all prize draw slots', () => {
    const proof = createFullProof(result);
    const verified = verifyFullProof(proof);
    expect(verified.winners).toEqual(result.winners);
    expect(verified.winners.map(({ prizeIndex }) => prizeIndex)).toEqual([0, 1]);
  });

  it('rejects modified participant inputs, prizes, timestamps, and result digests', () => {
    const proof = createFullProof(result);
    expect(() => verifyFullProof({ ...proof, participantCount: 2 })).toThrow('参与者摘要');
    expect(() => verifyFullProof({ ...proof, prizes: [{ name: '特等奖', count: 2 }] })).toThrow('结果摘要');
    expect(() => assertPublicProof({ ...proof, targetBlockTimestamp: 0 })).toThrow('时间戳');
    expect(() => verifyFullProof({ ...proof, resultDigest: `0x${'00'.repeat(32)}` })).toThrow('结果摘要');
  });

  it('rejects obsolete proof versions', () => {
    const proof = createFullProof(result);
    expect(() => assertPublicProof({ ...proof, proofVersion: 2 })).toThrow('仅支持最新');
  });

  it('keeps a 5000-person draw fully reproducible in its QR proof', () => {
    const rangeConfiguration = {
      participantSpec: { kind: 'range' as const, start: 1, end: 5000 },
      prizes: [{ id: 'p', name: '一等奖', count: 100 }],
    };
    const rangeComputed = runDraw(rangeConfiguration, blockHash);
    const proof = createFullProof({
      ...result,
      configuration: rangeConfiguration,
      participantDigest: participantDigest(rangeConfiguration),
      ...rangeComputed,
    });
    expect(selectQrProof(proof).isSummary).toBe(false);
    expect(verifyFullProof(proof).winners).toEqual(rangeComputed.winners);
  });
});
