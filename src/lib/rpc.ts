export const PUBLIC_RPC_URLS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://1rpc.io/eth',
];

type FetchLike = typeof fetch;

type RpcResponse<T> = { result?: T; error?: { code: number; message: string } };

async function rpcCall<T>(url: string, method: string, params: unknown[], fetcher: FetchLike): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as RpcResponse<T>;
    if (payload.error) throw new Error(payload.error.message);
    if (payload.result === undefined) throw new Error('节点没有返回结果');
    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

export async function withRpcFallback<T>(action: (url: string) => Promise<T>, customUrl = ''): Promise<{ value: T; url: string }> {
  const urls = [...(customUrl.trim() ? [customUrl.trim()] : []), ...PUBLIC_RPC_URLS];
  const errors: string[] = [];
  for (const url of [...new Set(urls)]) {
    try { return { value: await action(url), url }; }
    catch (error) { errors.push(`${url}: ${error instanceof Error ? error.message : '未知错误'}`); }
  }
  throw new Error(`所有以太坊节点均不可用。${errors.at(-1) ?? ''}`);
}

export async function getMainnetHead(customUrl = '', fetcher: FetchLike = fetch): Promise<{ height: number; url: string }> {
  const result = await withRpcFallback(async (url) => {
    const chainId = await rpcCall<string>(url, 'eth_chainId', [], fetcher);
    if (Number.parseInt(chainId, 16) !== 1) throw new Error('节点不是 Ethereum Mainnet');
    const height = await rpcCall<string>(url, 'eth_blockNumber', [], fetcher);
    return Number.parseInt(height, 16);
  }, customUrl);
  return { height: result.value, url: result.url };
}

export type EthereumBlockInfo = { hash: string; timestamp: number; url: string };

export async function getBlockInfo(height: number, customUrl = '', fetcher: FetchLike = fetch): Promise<EthereumBlockInfo> {
  const result = await withRpcFallback(async (url) => {
    const chainId = await rpcCall<string>(url, 'eth_chainId', [], fetcher);
    if (Number.parseInt(chainId, 16) !== 1) throw new Error('节点不是 Ethereum Mainnet');
    const block = await rpcCall<{ hash: string; timestamp: string } | null>(url, 'eth_getBlockByNumber', [`0x${height.toString(16)}`, false], fetcher);
    if (!block?.hash) throw new Error('目标区块尚未产生');
    if (!/^0x[0-9a-fA-F]{64}$/.test(block.hash)) throw new Error('节点返回了无效区块哈希');
    if (!/^0x[0-9a-fA-F]+$/.test(block.timestamp ?? '')) throw new Error('节点返回了无效区块时间戳');
    const timestamp = Number.parseInt(block.timestamp, 16);
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new Error('节点返回了无效区块时间戳');
    return { hash: block.hash, timestamp };
  }, customUrl);
  return { ...result.value, url: result.url };
}

export type WaitStage = 'target' | 'confirmation-1' | 'confirmation-2' | 'complete';

export function getWaitStage(head: number, target: number): { stage: WaitStage; progress: number; label: string } {
  if (head < target) return { stage: 'target', progress: head >= target - 1 ? 35 : 12, label: `等待目标区块高度 #${target.toLocaleString()}` };
  if (head === target) return { stage: 'confirmation-1', progress: 55, label: '目标区块高度已产生，等待确认 0/2' };
  if (head === target + 1) return { stage: 'confirmation-2', progress: 78, label: '等待确认 1/2' };
  return { stage: 'complete', progress: 100, label: '等待确认 2/2，准备开奖' };
}
