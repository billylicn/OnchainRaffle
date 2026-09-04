import { useCallback, useEffect, useMemo, useState } from 'react';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { ArrowRight, Check, ChevronRight, FastForward, Hash, Pause, Play, Shuffle, Zap } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DrawSteps } from '../components/DrawSteps';
import { runDraw } from '../lib/algorithm';
import { loadConfirmedDraw, saveDrawResult } from '../lib/storage';

type ComputeSpeed = 1 | 2 | 5;

const CHUNKS_PER_SEED = 10;
const MANUAL_REVEAL_DELAY = 1_200;

function seedAt(blockHash: string, round: number) {
  let seed = hexToBytes(blockHash.slice(2));
  let previous: Uint8Array | undefined;
  for (let index = 0; index < round; index += 1) {
    previous = seed;
    seed = sha256(seed);
  }
  return {
    current: bytesToHex(seed),
    previous: previous ? bytesToHex(previous) : undefined,
  };
}

export function CalculatePage() {
  const navigate = useNavigate();
  const confirmed = loadConfirmedDraw();
  const computed = useMemo(() => confirmed ? runDraw(confirmed.configuration, confirmed.blockHash) : null, [confirmed]);
  const [visible, setVisible] = useState(0);
  const [pendingVisible, setPendingVisible] = useState<number | null>(null);
  const [automatic, setAutomatic] = useState(false);
  const [speed, setSpeed] = useState<ComputeSpeed>(1);

  const acceptedEvents = useMemo(() => computed?.trace.filter((event) => event.accepted) ?? [], [computed]);
  const revealedCount = computed?.trace.slice(0, visible).filter((event) => event.accepted).length ?? 0;
  const finished = Boolean(computed && visible >= computed.trace.length);
  const computing = pendingVisible !== null;

  const startNextResult = useCallback(() => {
    if (!computed || finished || computing) return;
    const nextAcceptedIndex = computed.trace.findIndex((event, index) => index >= visible && event.accepted);
    if (nextAcceptedIndex >= 0) setPendingVisible(nextAcceptedIndex + 1);
  }, [computed, computing, finished, visible]);

  useEffect(() => {
    if (pendingVisible === null) return;
    const delay = automatic ? Math.max(240, MANUAL_REVEAL_DELAY / speed) : MANUAL_REVEAL_DELAY;
    const timer = window.setTimeout(() => {
      setVisible(pendingVisible);
      setPendingVisible(null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [automatic, pendingVisible, speed]);

  useEffect(() => {
    if (!automatic || !computed || finished || computing) return;
    const nextWinner = computed.winners[revealedCount];
    if (!nextWinner) return;
    const prize = confirmed?.configuration.prizes.find((item) => item.name === nextWinner.prize);
    const delay = Math.max(16, 4_000 / speed / Math.max(1, prize?.count ?? 1));
    const timer = window.setTimeout(startNextResult, delay);
    return () => window.clearTimeout(timer);
  }, [automatic, computed, confirmed, computing, finished, revealedCount, speed, startNextResult]);

  useEffect(() => {
    if (!confirmed || !computed || !finished) return;
    const timer = window.setTimeout(() => {
      saveDrawResult({ ...confirmed, ...computed, completedAt: new Date().toISOString() });
      navigate('/draw/result');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [computed, confirmed, finished, navigate]);

  if (!confirmed || !computed) return <Navigate to="/draw/wait" replace />;
  const displayedVisible = pendingVisible ?? visible;
  const current = displayedVisible > 0 ? computed.trace[displayedVisible - 1] : undefined;
  const traceIndex = current ? displayedVisible - 1 : 0;
  const seedRound = Math.floor(traceIndex / CHUNKS_PER_SEED);
  const activeChunkIndex = current ? traceIndex % CHUNKS_PER_SEED : -1;
  const seed = seedAt(confirmed.blockHash, seedRound);
  const seedParts = Array.from({ length: CHUNKS_PER_SEED }, (_, index) => seed.current.slice(index * 6, index * 6 + 6));
  const unusedSeedTail = seed.current.slice(60);
  const currentWinner = current?.accepted ? computed.winners[Math.max(0, revealedCount - (computing ? 0 : 1))] : undefined;
  const nextWinner = computed.winners[revealedCount];
  const currentPrize = currentWinner?.prize ?? nextWinner?.prize ?? '等待开始';
  const finish = () => {
    saveDrawResult({ ...confirmed, ...computed, completedAt: new Date().toISOString() });
    navigate('/draw/result');
  };

  return (
    <main className="page-shell draw-page calculate-page">
      <DrawSteps active={4} />
      <div className="calculate-heading"><span className="status-kicker">{confirmed.algorithmVersion}</span><h1>正在公开计算中奖结果</h1></div>
      <section className="compute-console">
        <div className="compute-stats"><div><Hash size={17} /><span>已读取片段</span><strong>{displayedVisible.toLocaleString()}</strong></div><div><Check size={17} /><span>已揭晓结果</span><strong>{revealedCount.toLocaleString()}</strong></div><div><Shuffle size={17} /><span>总中奖槽位</span><strong>{computed.winners.length.toLocaleString()}</strong></div></div>
        <div className="compute-hash"><span>目标区块高度 #{confirmed.targetBlock.toLocaleString()}</span><code>{confirmed.blockHash}</code></div>
        <div className="seed-inspector">
          <div className="seed-inspector-heading">
            <div><span>当前数字来源</span><strong>Seed<sub>{seedRound}</sub></strong></div>
            <small>{seedRound === 0 ? '目标区块哈希去掉 0x 后直接作为 Seed₀' : '由上一轮 Seed 通过 SHA-256 确定性派生'}</small>
          </div>
          {seed.previous && <div className="seed-relation" aria-label={`Seed ${seedRound - 1} 通过 SHA-256 派生 Seed ${seedRound}`}>
            <span><small>上一轮 Seed<sub>{seedRound - 1}</sub></small><code>{seed.previous}</code></span>
            <ArrowRight size={17} />
            <b>SHA-256</b>
            <ArrowRight size={17} />
            <span><small>当前 Seed<sub>{seedRound}</sub></small><code>{seed.current}</code></span>
          </div>}
          <div className="seed-segments" aria-label={`Seed ${seedRound} 的六位切片`}>
            {seedParts.map((part, index) => <span className={index === activeChunkIndex ? 'is-active' : ''} key={`${part}-${index}`}><small>{index + 1}</small>{part}</span>)}
            <span className="is-unused"><small>不参与本轮</small>{unusedSeedTail}</span>
          </div>
        </div>
        <div className={`compute-stage ${visible === 0 ? 'is-idle' : ''}`}>
          {current ? <>
            <div className="chunk-value"><small>正在使用的六位切片</small><strong>{current.chunk}</strong><span>转为整数 {current.value.toLocaleString()}</span></div>
            <div className={`remainder-card ${current.accepted ? 'accepted' : 'rejected'}`}>
              {current.accepted ? <>
                <div className="remainder-expression"><span>{current.value.toLocaleString()}</span><b>%</b><span>{current.remaining.toLocaleString()} 个待抽</span><span className="remainder-inline-result">余数 <strong>{current.value % current.remaining}</strong></span></div>
                <div className="remainder-result"><span>中奖者位于待抽序列的第 <strong>{current.value % current.remaining + 1}</strong> 个位置</span></div>
              </> : <>
                <small>公平范围检查</small>
                <div className="remainder-rejected">候选数字超出公平范围，不计算余数，继续读取下一片段。</div>
              </>}
            </div>
            <div className={`decision ${current.accepted ? 'accepted' : 'rejected'} ${computing ? 'is-computing' : ''}`}><span>{current.accepted ? computing ? '正在从待抽区域定位' : '从待抽区域抽出' : '超出无偏范围，丢弃'}</span>{current.participantId && <strong className={computing ? 'winner-blurred' : ''} aria-label={computing ? '中奖编号计算中' : undefined}>中奖编号 {current.participantId}</strong>}</div>
          </> : <div className="compute-ready"><Zap size={27} /><strong>等待开始运算</strong><span>点击“开始运算”后，系统才会高亮首个哈希片段并揭晓 {currentPrize}</span><b className="winner-placeholder">中奖编号 ••••</b></div>}
        </div>
        <div className="compute-progress"><div style={{ width: `${revealedCount === 0 ? 0 : revealedCount / acceptedEvents.length * 100}%` }} /></div>
        <div className="compute-current-prize"><span>当前奖项</span><strong>{currentPrize}</strong><small>{revealedCount} / {computed.winners.length} 个结果已揭晓</small></div>
      </section>
      <div className="compute-controls">
        <button className="button button-primary button-large" disabled={finished || automatic || computing} onClick={startNextResult}>{computing ? <Zap className="spin" size={18} /> : <ChevronRight size={18} />} {computing ? '正在运算' : revealedCount === 0 ? '开始运算' : '计算下一结果'}</button>
        <button className={`button button-quiet button-large ${automatic ? 'is-active' : ''}`} aria-pressed={automatic} disabled={finished} onClick={() => setAutomatic((value) => !value)}>{automatic ? <Pause size={18} /> : <Play size={18} />} {automatic ? '暂停自动运算' : '自动运算剩余结果'}</button>
        <div className="speed-control" aria-label="自动运算速度"><span>每个奖项默认 4 秒</span>{([1, 2, 5] as ComputeSpeed[]).map((value) => <button aria-pressed={speed === value} className={speed === value ? 'is-selected' : ''} key={value} onClick={() => setSpeed(value)}>{value}x</button>)}</div>
        <button className="button button-quiet button-large direct-draw" onClick={finish}><FastForward size={17} /> 直接开奖</button>
      </div>
    </main>
  );
}
