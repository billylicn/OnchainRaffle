import { useMemo } from 'react';
import { Award, Copy, Download, QrCode, RotateCcw, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DrawSteps } from '../components/DrawSteps';
import { createFullProof, selectQrProof } from '../lib/proof';
import { loadDrawResult, startNewDraw } from '../lib/storage';
import { formatBlockTime, formatUnixTimestamp } from '../lib/time';

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ResultPage() {
  const navigate = useNavigate();
  const result = loadDrawResult();
  const proofData = useMemo(() => {
    if (!result) return null;
    const full = createFullProof(result);
    const qr = selectQrProof(full);
    const base = `${window.location.origin}${window.location.pathname}`;
    return { full, ...qr, url: `${base}#/verify?proof=${qr.encoded}` };
  }, [result]);
  if (!result || !proofData) return <Navigate to="/draw/setup" replace />;
  const nameMap = new Map(result.configuration.participantSpec.kind === 'list' ? result.configuration.participantSpec.participants.map(({ id, name }) => [id, name]) : []);
  const grouped = result.configuration.prizes.map((prize) => ({ prize, winners: result.winners.filter((winner) => winner.prize === prize.name) }));
  const restart = () => { startNewDraw(); navigate('/draw/setup'); };

  return (
    <main className="page-shell draw-page result-page">
      <DrawSteps active={5} />
      <div className="result-heading"><span className="success-mark"><Award size={31} /></span><div><span className="section-kicker">开奖完成</span><h1>中奖结果已确定</h1><p>区块 #{result.targetBlock.toLocaleString()}，已通过两个后继区块确认。</p></div></div>
      <div className="result-chain-time"><span>目标区块链上时间</span>{result.targetBlockTimestamp ? <><strong>{formatBlockTime(result.targetBlockTimestamp)}</strong><code>{formatUnixTimestamp(result.targetBlockTimestamp)}</code></> : <strong>旧版本结果未记录</strong>}</div>
      <div className="result-layout">
        <div className="winner-groups">{grouped.map(({ prize, winners }) => <section key={prize.id}><header><h2>{prize.name}</h2><span>{winners.length} 名</span></header><div className="winner-list">{winners.map((winner) => <article key={`${winner.prize}-${winner.participantId}`}><div><span className="draw-order">第 {winner.prizeIndex + 1} 次抽取 · {winner.prize}</span><strong>编号 {winner.participantId}</strong>{nameMap.get(winner.participantId) && <small>{nameMap.get(winner.participantId)}</small>}</div><ShieldCheck size={18} /></article>)}</div></section>)}</div>
        <aside className="proof-preview">
          <div className="qr-frame"><QRCodeSVG value={proofData.url} size={186} level="L" /></div>
          <div className="proof-mode"><QrCode size={15} /><span>完整复算二维码</span></div>
          <h2>扫码验证本次开奖</h2>
          <p>二维码记录参与总人数、奖项次序和链上区块信息，另一台设备会重新计算并展示全部中奖编号。</p>
          <button className="button button-primary" onClick={() => downloadJson(`chain-draw-${result.targetBlock}.json`, proofData.full)}><Download size={16} /> 下载完整 JSON</button>
          <button className="button button-quiet" onClick={() => navigator.clipboard.writeText(proofData.url)}><Copy size={16} /> 复制验证链接</button>
          <div className="privacy-line"><ShieldCheck size={14} /> 公开凭证不包含姓名</div>
        </aside>
      </div>
      <div className="page-actions"><button className="button button-quiet button-large" onClick={restart}><RotateCcw size={17} /> 发起新抽奖</button></div>
    </main>
  );
}
