import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Blocks, CheckCircle2, FileJson, Github, LoaderCircle, ShieldCheck, Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { assertPublicProof, decodeProof, proofParticipantCount, verifyFullProof, type PublicProof } from '../lib/proof';
import { getBlockInfo } from '../lib/rpc';
import { loadCustomRpc } from '../lib/storage';
import { formatBlockTime, formatUnixTimestamp } from '../lib/time';
import type { Winner } from '../types/draw';

const SOURCE_REPO_URL = import.meta.env.VITE_SOURCE_REPO_URL ?? '';

export function VerifyPage() {
  const [params] = useSearchParams();
  const encodedProof = params.get('proof');
  const fileInput = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<PublicProof | null>(null);
  const [verifiedWinners, setVerifiedWinners] = useState<Winner[]>([]);
  const [error, setError] = useState('');
  const [localOk, setLocalOk] = useState(false);
  const [chainStatus, setChainStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [chainMessage, setChainMessage] = useState('');

  const inspectProof = (candidate: PublicProof) => {
    setProof(candidate);
    setError('');
    try {
      const verified = verifyFullProof(candidate);
      setVerifiedWinners(verified.winners);
      setLocalOk(true);
    } catch (verifyError) {
      setVerifiedWinners([]);
      setLocalOk(false);
      setError(verifyError instanceof Error ? verifyError.message : '本地复算失败');
    }
  };

  useEffect(() => {
    if (!encodedProof) return;
    try { inspectProof(decodeProof(encodedProof)); }
    catch (decodeError) { setError(decodeError instanceof Error ? decodeError.message : '二维码凭证无法读取'); }
  }, [encodedProof]);

  useEffect(() => {
    if (!proof) return;
    let active = true;
    setChainStatus('checking');
    getBlockInfo(proof.targetBlock, loadCustomRpc())
      .then(({ hash, timestamp, url }) => {
        if (!active) return;
        const hashMatches = hash.toLowerCase() === proof.blockHash.toLowerCase();
        const timestampMatches = timestamp === proof.targetBlockTimestamp;
        if (hashMatches && timestampMatches) {
          setChainStatus('ok');
          setChainMessage(`主网区块哈希与链上时间一致 · ${url}`);
        } else {
          setChainStatus('error');
          setChainMessage(hashMatches ? '主网链上时间戳与凭证不一致' : '主网区块哈希与凭证不一致');
        }
      })
      .catch((chainError) => {
        if (active) {
          setChainStatus('error');
          setChainMessage(chainError instanceof Error ? chainError.message : '暂时无法连接主网');
        }
      });
    return () => { active = false; };
  }, [proof]);

  const importFile = async (file?: File) => {
    if (!file) return;
    try { inspectProof(assertPublicProof(JSON.parse(await file.text()))); }
    catch (fileError) { setError(fileError instanceof Error ? fileError.message : 'JSON 凭证无法读取'); }
  };

  const participantTotal = proof ? proofParticipantCount(proof) : 0;
  const prizeSlots = proof?.prizes.reduce((sum, prize) => sum + prize.count, 0) ?? 0;

  return (
    <main className="page-shell verify-page">
      <div className="verify-heading"><span className="verify-mark"><ShieldCheck size={31} /></span><div><span className="section-kicker">算法公证</span><h1>开奖验证</h1><p>不需要只相信主办方的结果，验证页会查询公开数据并重新计算一次。</p></div></div>
      {!proof ? (
        <section className="verify-empty"><FileJson size={38} /><h2>导入最新 JSON 凭证</h2><p>也可以扫描结果页二维码，验证信息会自动出现在这里。</p><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} /><button className="button button-primary button-large" onClick={() => fileInput.current?.click()}><Upload size={17} /> 选择凭证文件</button>{error && <div className="inline-error"><AlertCircle size={15} /> {error}</div>}</section>
      ) : (
        <div className="verify-layout">
          <section className="verification-report">
            <header><div><span>完整复算凭证</span><h2>目标区块高度 #{proof.targetBlock.toLocaleString()}</h2></div><code>PROOF V{proof.proofVersion} · {proof.algorithmVersion}</code></header>
            <div className="proof-overview"><div><span>网络</span><strong>Ethereum Mainnet</strong><small>chainId = 1</small></div><div><span>目标区块高度</span><strong>#{proof.targetBlock.toLocaleString()}</strong><small>未来高度锁定</small></div><div><span>目标区块链上时间</span><strong>{formatBlockTime(proof.targetBlockTimestamp)}</strong><small>{formatUnixTimestamp(proof.targetBlockTimestamp)}</small></div><div><span>参与总人数</span><strong>{participantTotal.toLocaleString()} 人</strong><small>{proof.prizes.length} 个奖项 · {prizeSlots} 个名额</small></div></div>
            <section className="verification-trust"><h3>为什么验证结果可信</h3><p>完整验证不是查看一张结果截图，而是从公开输入重新走一遍开奖过程。</p><div><article><span>01</span><strong>核对抽签种子</strong><small>直接查询 Ethereum Mainnet，确认目标区块高度的哈希和链上时间没有被替换。</small></article><article><span>02</span><strong>还原编号与奖项次序</strong><small>根据参与总人数还原从 1 连续递增的编号，再按凭证中的奖项顺序和名额建立抽奖次序。</small></article><article><span>03</span><strong>重新计算中奖编号</strong><small>使用 CHAIN_DRAW_V1 完整复算；重新得到的中奖编号摘要一致才会通过。</small></article></div></section>
            <div className="verification-checks">
              <article className={chainStatus}><span>{chainStatus === 'checking' ? <LoaderCircle className="spin" /> : chainStatus === 'ok' ? <CheckCircle2 /> : <AlertCircle />}</span><div><strong>{chainStatus === 'ok' ? '链上哈希已核对' : chainStatus === 'checking' ? '正在查询 Ethereum Mainnet' : '链上核对未完成'}</strong><p>{chainMessage || '正在连接公共以太坊节点'}</p></div></article>
              <article className={localOk ? 'ok' : 'error'}><span>{localOk ? <CheckCircle2 /> : <AlertCircle />}</span><div><strong>{localOk ? '算法复算一致' : '算法复算不一致'}</strong><p>{error || '参与者摘要、拒绝采样、抽奖次序和结果摘要均一致'}</p></div></article>
            </div>
            <dl className="proof-details"><div><dt>区块哈希</dt><dd><code>{proof.blockHash}</code></dd></div><div><dt>编号规则</dt><dd>1 至 {proof.participantCount.toLocaleString()} 连续递增</dd></div><div><dt>参与者摘要</dt><dd><code>{proof.participantDigest}</code></dd></div><div><dt>结果摘要</dt><dd><code>{proof.resultDigest}</code></dd></div><div><dt>完成确认区块高度</dt><dd>#{proof.confirmationBlock.toLocaleString()}</dd></div></dl>
            {localOk && <div className="verified-winners"><h2>复算中奖编号</h2>{proof.prizes.map((prize) => <div className="verified-prize" key={prize.name}><strong>{prize.name}</strong><div>{verifiedWinners.filter((winner) => winner.prize === prize.name).map((winner) => <span key={winner.prizeIndex}><small>第 {winner.prizeIndex + 1} 次抽取</small><b>编号 {winner.participantId}</b></span>)}</div></div>)}</div>}
          </section>
          <aside className="verify-aside"><Blocks size={24} /><h2>完整验证说明</h2><p>参与编号固定为从 1 连续递增，因此凭证只需记录参与总人数，就能还原全部待抽编号。奖项名称、名额和排列顺序共同确定每一次抽取属于哪个奖项。姓名不参与计算，中奖身份始终以编号为准。</p><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} /><button className="button button-quiet" onClick={() => fileInput.current?.click()}><Upload size={16} /> 导入其他 JSON</button>{SOURCE_REPO_URL ? <a className="button button-quiet" href={SOURCE_REPO_URL} target="_blank" rel="noreferrer"><Github size={16} /> 查看源代码</a> : <button className="button button-quiet" disabled><Github size={16} /> 源代码即将开放</button>}</aside>
        </div>
      )}
    </main>
  );
}
