import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { deflate, inflate } from 'pako';
import type { DrawConfiguration, DrawResult, ParticipantSpec, Winner } from '../types/draw';
import { ALGORITHM_VERSION } from '../types/draw';
import { participantCount } from './participants';
import { participantDigest, runDraw } from './algorithm';

export const PROOF_VERSION = 3 as const;

type PublicPrize = { name: string; count: number };
type ParticipantMode = ParticipantSpec['kind'];

export type DrawProofV3 = {
  kind: 'full';
  proofVersion: typeof PROOF_VERSION;
  algorithmVersion: typeof ALGORITHM_VERSION;
  chainId: 1;
  targetBlock: number;
  blockHash: string;
  confirmationBlock: number;
  confirmedHeight: number;
  targetBlockTimestamp: number;
  participantMode: ParticipantMode;
  participantCount: number;
  participantDigest: string;
  prizes: PublicPrize[];
  resultDigest: string;
};

export type FullProof = DrawProofV3;
export type PublicProof = DrawProofV3;

export function resultDigest(winners: Winner[]): string {
  const canonical = JSON.stringify(winners.map(({ prize, prizeIndex, participantId }) => [prize, prizeIndex, participantId]));
  return `0x${bytesToHex(sha256(utf8ToBytes(canonical)))}`;
}

export function createFullProof(result: DrawResult): DrawProofV3 {
  return {
    kind: 'full',
    proofVersion: PROOF_VERSION,
    algorithmVersion: result.algorithmVersion,
    chainId: 1,
    targetBlock: result.targetBlock,
    blockHash: result.blockHash,
    confirmationBlock: result.confirmationBlock,
    confirmedHeight: result.confirmedHead,
    targetBlockTimestamp: result.targetBlockTimestamp,
    participantMode: result.configuration.participantSpec.kind,
    participantCount: participantCount(result.configuration),
    participantDigest: result.participantDigest,
    prizes: result.configuration.prizes.map(({ name, count }) => ({ name, count })),
    resultDigest: resultDigest(result.winners),
  };
}

export function encodeProof(proof: PublicProof): string {
  const compressed = deflate(utf8ToBytes(JSON.stringify(proof)), { level: 9 });
  let binary = '';
  for (let offset = 0; offset < compressed.length; offset += 0x8000) binary += String.fromCharCode(...compressed.subarray(offset, offset + 0x8000));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function decodeProof(encoded: string): PublicProof {
  const padded = encoded.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - encoded.length % 4) % 4);
  const compressed = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return assertPublicProof(JSON.parse(new TextDecoder().decode(inflate(compressed))));
}

export function selectQrProof(full: DrawProofV3): { proof: DrawProofV3; encoded: string; isSummary: false } {
  return { proof: full, encoded: encodeProof(full), isSummary: false };
}

function configurationFromProof(proof: DrawProofV3): DrawConfiguration {
  const participantSpec: ParticipantSpec = proof.participantMode === 'list'
    ? { kind: 'list', participants: Array.from({ length: proof.participantCount }, (_, index) => ({ id: String(index + 1) })) }
    : { kind: 'range', start: 1, end: proof.participantCount };
  return { participantSpec, prizes: proof.prizes.map((prize, index) => ({ id: `proof-${index}`, ...prize })) };
}

export function verifyFullProof(proof: FullProof): { configuration: DrawConfiguration; winners: Winner[] } {
  const configuration = configurationFromProof(proof);
  if (participantDigest(configuration) !== proof.participantDigest) throw new Error('参与者摘要不一致');
  const calculated = runDraw(configuration, proof.blockHash);
  if (resultDigest(calculated.winners) !== proof.resultDigest) throw new Error('结果摘要与重新计算不一致');
  return { configuration, winners: calculated.winners };
}

export function assertPublicProof(value: unknown): PublicProof {
  if (!value || typeof value !== 'object') throw new Error('凭证不是有效对象');
  const proof = value as Partial<DrawProofV3>;
  if (proof.proofVersion !== PROOF_VERSION || proof.algorithmVersion !== ALGORITHM_VERSION || proof.chainId !== 1) throw new Error('仅支持最新的 DrawProofV3 凭证');
  if (proof.kind !== 'full') throw new Error('凭证类型无效');
  if (!Number.isSafeInteger(proof.targetBlock) || (proof.targetBlock ?? 0) < 1 || !/^0x[0-9a-fA-F]{64}$/.test(proof.blockHash ?? '')) throw new Error('区块信息无效');
  if (!Number.isSafeInteger(proof.confirmationBlock) || proof.confirmationBlock !== (proof.targetBlock ?? 0) + 2) throw new Error('确认区块高度无效');
  if (!Number.isSafeInteger(proof.confirmedHeight) || (proof.confirmedHeight ?? 0) < (proof.confirmationBlock ?? 0)) throw new Error('最终确认区块高度无效');
  if (!Number.isSafeInteger(proof.targetBlockTimestamp) || (proof.targetBlockTimestamp ?? 0) <= 0) throw new Error('目标区块链上时间戳无效');
  if (proof.participantMode !== 'list' && proof.participantMode !== 'range') throw new Error('参与者模式无效');
  const maximumParticipants = proof.participantMode === 'list' ? 200 : 5000;
  const participantTotal = proof.participantCount;
  if (!Number.isSafeInteger(participantTotal) || participantTotal === undefined || participantTotal < 1 || participantTotal > maximumParticipants) throw new Error('参与总人数无效');
  if (!/^0x[0-9a-fA-F]{64}$/.test(proof.participantDigest ?? '') || !/^0x[0-9a-fA-F]{64}$/.test(proof.resultDigest ?? '')) throw new Error('摘要格式无效');
  if (!Array.isArray(proof.prizes) || !proof.prizes.length || proof.prizes.length > 20) throw new Error('奖项配置无效');
  const prizeNames = new Set<string>();
  let winnerCount = 0;
  for (const prize of proof.prizes) {
    const name = prize?.name?.trim();
    if (!name || name.length > 30 || name !== prize.name || prizeNames.has(name) || !Number.isSafeInteger(prize.count) || prize.count < 1) throw new Error('奖项配置无效');
    prizeNames.add(name);
    winnerCount += prize.count;
  }
  if (winnerCount > participantTotal) throw new Error('中奖总名额超过参与总人数');
  return proof as DrawProofV3;
}

export function proofParticipantCount(proof: PublicProof): number {
  return proof.participantCount;
}
