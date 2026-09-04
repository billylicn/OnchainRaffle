import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDraft, loadConfiguration, loadConfirmedDraw, loadCustomRpc, loadDrawResult, loadLockedDraw, saveConfiguration, saveConfirmedDraw, saveCustomRpc, saveDrawResult, saveLockedDraw, startNewDraw } from './storage';
import { ALGORITHM_VERSION, type ConfirmedDraw, type DrawConfiguration, type DrawResult, type LockedDraw } from '../types/draw';

const configuration: DrawConfiguration = {
  participantSpec: { kind: 'list', participants: [{ id: '1', name: '张三' }] },
  prizes: [{ id: 'first', name: '一等奖', count: 1 }],
};

const locked: LockedDraw = {
  algorithmVersion: ALGORITHM_VERSION,
  chainId: 1,
  configuration,
  participantDigest: `0x${'11'.repeat(32)}`,
  headAtLock: 100,
  targetBlock: 102,
  confirmationBlock: 104,
  lockedAt: '2026-09-04T00:00:00.000Z',
};

const confirmed: ConfirmedDraw = {
  ...locked,
  blockHash: `0x${'22'.repeat(32)}`,
  targetBlockTimestamp: 1_788_480_000,
  confirmedHead: 104,
  rpcUrl: 'https://example.test',
};

describe('draw storage', () => {
  beforeAll(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, String(value)),
      },
    });
  });

  beforeEach(() => localStorage.clear());

  it('migrates a legacy pasted-text draft into editable rows', () => {
    localStorage.setItem('chain-draw:draft:v1', JSON.stringify({
      mode: 'list',
      pastedText: '编号\t姓名\n1\t张三\n2\t李四',
      firstRowHeader: true,
      rangeStart: '1',
      rangeEnd: '100',
      prizes: [{ id: 'first', name: '一等奖', count: 1 }],
    }));
    const draft = loadDraft();
    expect(draft.participantRows.slice(0, 2)).toEqual([{ id: '1', name: '张三' }, { id: '2', name: '李四' }]);
    expect(draft.participantRows).toHaveLength(10);
    expect(draft).not.toHaveProperty('pastedText');
  });

  it('starts a new draw while retaining draft and RPC preferences', () => {
    localStorage.setItem('chain-draw:draft:v1', JSON.stringify({ ...loadDraft(), rangeStart: '9' }));
    saveCustomRpc('https://rpc.example.test');
    saveConfiguration(configuration);
    saveLockedDraw(locked);
    saveConfirmedDraw(confirmed);
    saveDrawResult({ ...confirmed, winners: [{ prize: '一等奖', prizeIndex: 0, participantId: '1' }], trace: [], completedAt: '2026-09-04T00:01:00.000Z' } as DrawResult);

    startNewDraw();

    expect(loadDraft().rangeStart).toBe('1');
    expect(loadCustomRpc()).toBe('https://rpc.example.test');
    expect(loadConfiguration()).toBeNull();
    expect(loadLockedDraw()).toBeNull();
    expect(loadConfirmedDraw()).toBeNull();
    expect(loadDrawResult()).toBeNull();
  });
});
