import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Blocks, CheckCircle2, Clock3, LoaderCircle, RotateCcw, Server } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DrawSteps } from '../components/DrawSteps';
import { getBlockInfo, getMainnetHead, getWaitStage, type EthereumBlockInfo } from '../lib/rpc';
import { clearDrawSession, loadCustomRpc, loadLockedDraw, saveConfirmedDraw } from '../lib/storage';
import { formatBlockTime, formatUnixTimestamp } from '../lib/time';

export function WaitPage() {
  const navigate = useNavigate();
  const [locked] = useState(loadLockedDraw);
  const [height, setHeight] = useState(locked?.headAtLock ?? 0);
  const [targetHash, setTargetHash] = useState('');
  const [targetTimestamp, setTargetTimestamp] = useState(0);
  const [rpcUrl, setRpcUrl] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [reorgNote, setReorgNote] = useState('');
  const [customRpc] = useState(loadCustomRpc);
  const pollingRef = useRef(false);
  const blockRef = useRef<EthereumBlockInfo | null>(null);

  const poll = useCallback(async () => {
    if (!locked || pollingRef.current) return;
    pollingRef.current = true;
    setChecking(true);
    setError('');
    try {
      const latest = await getMainnetHead(customRpc);
      setHeight(latest.height);
      setRpcUrl(latest.url);
      let observedBlock = blockRef.current;
      if (latest.height >= locked.targetBlock && !observedBlock) {
        observedBlock = await getBlockInfo(locked.targetBlock, customRpc);
        blockRef.current = observedBlock;
        setTargetHash(observedBlock.hash);
        setTargetTimestamp(observedBlock.timestamp);
      }
      if (latest.height >= locked.confirmationBlock && observedBlock) {
        const finalBlock = await getBlockInfo(locked.targetBlock, customRpc);
        if (finalBlock.hash !== observedBlock.hash || finalBlock.timestamp !== observedBlock.timestamp) {
          setReorgNote('确认期间检测到链重组，已采用确认后的主链区块信息。');
          observedBlock = finalBlock;
          blockRef.current = finalBlock;
          setTargetHash(finalBlock.hash);
          setTargetTimestamp(finalBlock.timestamp);
        }
        saveConfirmedDraw({
          ...locked,
          blockHash: observedBlock.hash,
          targetBlockTimestamp: observedBlock.timestamp,
          confirmedHead: latest.height,
          rpcUrl: finalBlock.url,
        });
        navigate('/draw/calculate');
      }
    } catch (pollError) {
      setError(pollError instanceof Error ? pollError.message : '节点连接暂时失败');
    } finally {
      pollingRef.current = false;
      setChecking(false);
    }
  }, [customRpc, locked, navigate]);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), 5_000);
    return () => window.clearInterval(timer);
  }, [poll]);

  if (!locked) return <Navigate to="/draw/setup" replace />;
  const status = getWaitStage(height, locked.targetBlock);
  const targetReached = height >= locked.targetBlock;
  const confirmations = targetReached ? Math.min(2, Math.max(0, height - locked.targetBlock)) : 0;
  const cancel = () => { clearDrawSession(); navigate('/draw/setup'); };

  return (
    <main className="page-shell draw-page wait-page">
      <DrawSteps active={3} />
      <div className="wait-center">
        <span className="status-kicker">ETHEREUM MAINNET · CHAIN ID 1</span>
        <h1>{status.label}</h1>
        <p>页面每 5 秒自动查询一次区块高度。关闭或刷新页面后仍可继续等待。</p>
        <div className="lock-height-flow" aria-label="目标区块高度锁定流程">
          <div className="lock-height-node current-height-node">
            <span className="height-node-index">01</span>
            <CheckCircle2 size={23} />
            <small>锁定时当前区块高度</small>
            <strong>#{locked.headAtLock.toLocaleString()}</strong>
            <em>已读取</em>
          </div>
          <div className="height-flow-link" aria-hidden="true"><i /><span>+2</span></div>
          <div className={`lock-height-node target-height-node ${targetReached ? 'is-reached' : ''}`}>
            <span className="height-node-index">02</span>
            {targetReached ? <CheckCircle2 size={23} /> : <Blocks size={23} />}
            <small>{targetReached ? '目标区块高度已产生' : '等待目标区块高度'}</small>
            <strong>#{locked.targetBlock.toLocaleString()}</strong>
            <em>{targetReached ? '已获取区块哈希' : '持续查询中'}</em>
          </div>
        </div>
        <div className={`confirmation-counter confirmation-${confirmations}`} aria-label={`等待确认 ${confirmations}/2`}>
          <div><span>等待确认</span><strong>{confirmations}/2</strong></div>
          <div className="confirmation-lights" aria-hidden="true"><i className={confirmations >= 1 ? 'is-complete' : ''} /><i className={confirmations >= 2 ? 'is-complete' : ''} /></div>
          <small>{!targetReached ? '目标区块高度产生后开始确认' : confirmations < 2 ? '正在等待后续区块确认，具体高度无需参与者记录' : '两个后续区块均已确认'}</small>
        </div>
        <div className="wait-progress" aria-label={`等待进度 ${status.progress}%`}><div style={{ width: `${status.progress}%` }} /></div>
        <div className="live-height-readout"><span>当前查询到的区块高度</span><strong>#{height.toLocaleString()}</strong>{checking && <small>正在刷新</small>}</div>
        <div className={`block-time-panel ${targetTimestamp ? 'is-ready' : ''}`}><Clock3 size={18} /><div><span>目标区块链上时间</span>{targetTimestamp ? <><strong>{formatBlockTime(targetTimestamp)}</strong><code>{formatUnixTimestamp(targetTimestamp)}</code></> : <small>目标区块高度产生后由 Ethereum Mainnet 返回</small>}</div></div>
        {targetHash && <div className="observed-hash"><span>目标区块高度 #{locked.targetBlock.toLocaleString()} 的区块哈希</span><code>{targetHash}</code></div>}
        <div className="rpc-status"><Server size={15} /><span>{checking ? '正在刷新区块高度' : error ? '节点重试中' : '节点连接正常'}</span>{checking && <LoaderCircle className="spin" size={15} />}</div>
        {error && <div className="wait-warning"><AlertTriangle size={17} />{error}</div>}
        {reorgNote && <div className="wait-warning"><RotateCcw size={17} />{reorgNote}</div>}
        {rpcUrl && <small className="rpc-url">当前节点：{rpcUrl}</small>}
        <button className="text-button cancel-draw" onClick={cancel}>取消本次锁定并重新配置</button>
      </div>
    </main>
  );
}
