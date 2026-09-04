import { describe, expect, it, vi } from 'vitest';
import { getBlockInfo, getMainnetHead, getWaitStage } from './rpc';

describe('Ethereum RPC', () => {
  it('checks mainnet and reads the latest height', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: '0x1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: '0x64' }), { status: 200 }));
    await expect(getMainnetHead('https://example.test', fetcher)).resolves.toEqual({ height: 100, url: 'https://example.test' });
  });

  it('models target plus two successor confirmations', () => {
    expect(getWaitStage(101, 102).stage).toBe('target');
    expect(getWaitStage(102, 102).stage).toBe('confirmation-1');
    expect(getWaitStage(103, 102).stage).toBe('confirmation-2');
    expect(getWaitStage(104, 102).stage).toBe('complete');
  });

  it('checks mainnet again before accepting block information', async () => {
    const hash = `0x${'ab'.repeat(32)}`;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: '0x1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { hash, timestamp: '0x6a9a0a00' } }), { status: 200 }));
    await expect(getBlockInfo(102, 'https://example.test', fetcher)).resolves.toEqual({ hash, timestamp: 1_788_480_000, url: 'https://example.test' });
  });

  it('switches nodes after a temporary custom RPC failure', async () => {
    const hash = `0x${'cd'.repeat(32)}`;
    const fetcher = vi.fn(async (input, init) => {
      const url = String(input);
      if (url === 'https://custom.test') throw new Error('offline');
      const method = JSON.parse(String(init?.body)).method as string;
      const result = method === 'eth_chainId' ? '0x1' : { hash, timestamp: '0x6a9a0a00' };
      return new Response(JSON.stringify({ result }), { status: 200 });
    }) as typeof fetch;
    await expect(getBlockInfo(102, 'https://custom.test', fetcher)).resolves.toEqual({ hash, timestamp: 1_788_480_000, url: 'https://ethereum-rpc.publicnode.com' });
  });

  it('rejects an invalid block timestamp', async () => {
    const hash = `0x${'ef'.repeat(32)}`;
    const fetcher = vi.fn(async (_input, init) => {
      const method = JSON.parse(String(init?.body)).method as string;
      const result = method === 'eth_chainId' ? '0x1' : { hash, timestamp: 'not-hex' };
      return new Response(JSON.stringify({ result }), { status: 200 });
    }) as typeof fetch;
    await expect(getBlockInfo(102, 'https://example.test', fetcher)).rejects.toThrow('无效区块时间戳');
  });
});
