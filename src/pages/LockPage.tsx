import { useState } from 'react';
import { ArrowLeft, ArrowRight, Blocks, CheckCircle2, Database, LoaderCircle, LockKeyhole, Network } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DrawSteps } from '../components/DrawSteps';
import { participantDigest } from '../lib/algorithm';
import { participantCount } from '../lib/participants';
import { getMainnetHead, PUBLIC_RPC_URLS } from '../lib/rpc';
import { clearDrawSession, loadConfiguration, loadCustomRpc, loadLockedDraw, saveCustomRpc, saveLockedDraw } from '../lib/storage';
import { ALGORITHM_VERSION, type LockedDraw } from '../types/draw';

const RPC_SOURCES = [
  { name: 'PublicNode', note: '默认', url: PUBLIC_RPC_URLS[0] },
  { name: 'LlamaRPC', note: '公共节点', url: PUBLIC_RPC_URLS[1] },
  { name: '1RPC', note: '公共节点', url: PUBLIC_RPC_URLS[2] },
] as const;

function initialRpcState() {
  const stored = loadCustomRpc().trim();
  return {
    source: PUBLIC_RPC_URLS.includes(stored) ? stored : stored ? 'custom' : PUBLIC_RPC_URLS[0],
    custom: PUBLIC_RPC_URLS.includes(stored) ? '' : stored,
  };
}

export function LockPage() {
  const navigate = useNavigate();
  const configuration = loadConfiguration();
  const existing = loadLockedDraw();
  const [initialRpc] = useState(initialRpcState);
  const [rpcSource, setRpcSource] = useState(initialRpc.source);
  const [customRpc, setCustomRpc] = useState(initialRpc.custom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!configuration) return <Navigate to="/draw/setup" replace />;

  const lock = async () => {
    setBusy(true);
    setError('');
    try {
      const selectedRpc = rpcSource === 'custom' ? customRpc.trim() : rpcSource;
      if (rpcSource === 'custom' && !/^https?:\/\//i.test(selectedRpc)) throw new Error('自定义 RPC 必须是有效的 HTTP(S) 地址');
      const { height } = await getMainnetHead(selectedRpc);
      const locked: LockedDraw = {
        algorithmVersion: ALGORITHM_VERSION,
        chainId: 1,
        configuration,
        participantDigest: participantDigest(configuration),
        headAtLock: height,
        targetBlock: height + 2,
        confirmationBlock: height + 4,
        lockedAt: new Date().toISOString(),
      };
      clearDrawSession();
      saveCustomRpc(selectedRpc);
      saveLockedDraw(locked);
      navigate('/draw/wait');
    } catch (lockError) {
      setError(lockError instanceof Error ? lockError.message : '无法锁定区块');
    } finally {
      setBusy(false);
    }
  };

  if (existing) return <Navigate to="/draw/wait" replace />;

  return (
    <main className="page-shell draw-page lock-page">
      <DrawSteps active={2} />
      <div className="page-title-row"><div><span className="section-kicker">第 3 步</span><h1>锁定一个未来区块高度</h1><p>网站会读取当前区块高度，并把第 2 个后继区块高度定为随机数来源。</p></div></div>
      <div className="lock-layout">
        <section className="lock-main">
          <div className="future-blocks" aria-hidden="true"><span className="past"><Blocks size={22} /></span><i /><span><span>+1</span></span><i /><span className="target"><LockKeyhole size={25} /><b>+2</b></span></div>
          <h2>目标高度将在点击时确定</h2>
          <p>锁定后将不能修改参与者和奖项。目标区块产生并经过两个后继区块确认后，网站才会执行计算。</p>
          <button className="button button-primary lock-button" disabled={busy} onClick={lock}>{busy ? <><LoaderCircle className="spin" size={20} /> 正在连接主网</> : <><LockKeyhole size={19} /> 查询并锁定区块高度</>}</button>
          {error && <div className="inline-error">{error}</div>}
        </section>
        <aside className="lock-summary">
          <h2>本次锁定内容</h2>
          <dl><div><dt>参与者</dt><dd>{participantCount(configuration).toLocaleString()} 人</dd></div><div><dt>中奖名额</dt><dd>{configuration.prizes.reduce((sum, prize) => sum + prize.count, 0)} 个</dd></div><div><dt>算法版本</dt><dd>{ALGORITHM_VERSION}</dd></div><div><dt>网络</dt><dd><Network size={14} /> Ethereum Mainnet</dd></div></dl>
          <div className="digest"><span>名单摘要</span><code>{participantDigest(configuration)}</code></div>
        </aside>
      </div>
      <section className="rpc-settings">
        <header className="rpc-settings-heading">
          <div><Database size={18} /><div><h2>区块数据源选择</h2><p>选择优先查询的 Ethereum Mainnet RPC，连接失败时会自动切换到其他内置数据源。</p></div></div>
          <span><Network size={14} /> chainId 1</span>
        </header>
        <div className="rpc-source-grid" role="radiogroup" aria-label="区块数据源">
          {RPC_SOURCES.map((source) => (
            <label key={source.url} className={rpcSource === source.url ? 'is-selected' : ''}>
              <input type="radio" name="rpc-source" value={source.url} checked={rpcSource === source.url} onChange={() => setRpcSource(source.url)} />
              <span><strong>{source.name}</strong><small>{source.note}</small></span>
              <code>{source.url}</code>
              <CheckCircle2 size={17} />
            </label>
          ))}
          <label className={rpcSource === 'custom' ? 'is-selected' : ''}>
            <input type="radio" name="rpc-source" value="custom" checked={rpcSource === 'custom'} onChange={() => setRpcSource('custom')} />
            <span><strong>自定义 RPC</strong><small>手动地址</small></span>
            <code>HTTPS Ethereum Mainnet</code>
            <CheckCircle2 size={17} />
          </label>
        </div>
        {rpcSource === 'custom' && <div className="rpc-field"><label htmlFor="rpc">自定义 Ethereum Mainnet RPC</label><input id="rpc" value={customRpc} onChange={(event) => setCustomRpc(event.target.value)} placeholder="https://your-mainnet-rpc.example" autoFocus /><small>地址必须支持 Ethereum Mainnet，并返回 <code>eth_chainId = 0x1</code>。请勿填写需要保密的长期密钥。</small></div>}
      </section>
      <div className="page-actions"><button className="button button-quiet button-large" onClick={() => navigate('/draw/algorithm')}><ArrowLeft size={18} /> 返回</button><button className="button button-primary button-large" disabled={busy} onClick={lock}>锁定并等待 <ArrowRight size={18} /></button></div>
    </main>
  );
}
