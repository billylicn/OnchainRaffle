import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { ALGORITHM_VERSION, type DrawConfiguration, type DrawTraceEvent, type Prize, type Winner } from '../types/draw';
import { participantIds } from './participants';

const RANDOM_SPACE = 2 ** 24;

export function participantDigest(configuration: DrawConfiguration): string {
  const canonical = configuration.participantSpec.kind === 'range'
    ? `range:${configuration.participantSpec.start}:${configuration.participantSpec.end}`
    : `list:${JSON.stringify(configuration.participantSpec.participants.map(({ id }) => id))}`;
  return `0x${bytesToHex(sha256(utf8ToBytes(canonical)))}`;
}

export function prizeSlots(prizes: Prize[]): string[] {
  return prizes.flatMap((prize) => Array.from({ length: prize.count }, () => prize.name));
}

export function randomChunks(blockHash: string): Generator<string> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(blockHash)) throw new Error('区块哈希格式无效');
  return (function* chunks() {
    let seed = hexToBytes(blockHash.slice(2));
    for (;;) {
      const hex = bytesToHex(seed);
      for (let offset = 0; offset < 60; offset += 6) yield hex.slice(offset, offset + 6);
      seed = sha256(seed);
    }
  })();
}

export function runDraw(configuration: DrawConfiguration, blockHash: string): { winners: Winner[]; trace: DrawTraceEvent[] } {
  const pool = participantIds(configuration);
  const slots = prizeSlots(configuration.prizes);
  if (slots.length > pool.length) throw new Error('中奖名额超过参与人数');
  const chunks = randomChunks(blockHash);
  const winners: Winner[] = [];
  const trace: DrawTraceEvent[] = [];
  let slot = 0;

  while (slot < slots.length) {
    const chunk = chunks.next().value as string;
    const value = Number.parseInt(chunk, 16);
    const remaining = pool.length - slot;
    const limit = Math.floor(RANDOM_SPACE / remaining) * remaining;
    const accepted = value < limit;
    const event: DrawTraceEvent = { slot, prize: slots[slot], chunk, value, remaining, limit, accepted };
    if (accepted) {
      const selectedIndex = slot + (value % remaining);
      [pool[slot], pool[selectedIndex]] = [pool[selectedIndex], pool[slot]];
      event.selectedIndex = selectedIndex;
      event.participantId = pool[slot];
      winners.push({ prize: slots[slot], prizeIndex: slot, participantId: pool[slot] });
      slot += 1;
    }
    trace.push(event);
  }
  return { winners, trace };
}
