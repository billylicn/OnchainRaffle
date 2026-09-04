import { ArrowRight, Blocks, CheckCircle2, GitFork, Github, ShieldCheck, Sparkles, Star, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import pkg from '../package.json';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AlgorithmPage } from './pages/AlgorithmPage';
import { SetupPage } from './pages/SetupPage';
import { LockPage } from './pages/LockPage';
import { WaitPage } from './pages/WaitPage';
import { CalculatePage } from './pages/CalculatePage';
import { ResultPage } from './pages/ResultPage';
import { VerifyPage } from './pages/VerifyPage';
import { hasUnfinishedDraw, startNewDraw } from './lib/storage';

const SOURCE_REPO_URL = import.meta.env.VITE_SOURCE_REPO_URL ?? '';
const REPO_NAME = SOURCE_REPO_URL.split('/').filter(Boolean).pop() ?? '';
const REPO_API_URL = SOURCE_REPO_URL.replace('https://github.com/', 'https://api.github.com/repos/');

interface RepoInfo {
  stars: number;
  forks: number;
  tag: string | null;
}

function formatRepoCount(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    const fixed = thousands >= 100 ? thousands.toFixed(0) : thousands.toFixed(1);
    return `${fixed.replace(/\.0$/, '')}k`;
  }
  return String(value);
}

function useRepoInfo(apiUrl: string): RepoInfo | null {
  const [info, setInfo] = useState<RepoInfo | null>(null);
  useEffect(() => {
    if (!apiUrl) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const repoResponse = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } });
        if (!repoResponse.ok) return;
        const repo = await repoResponse.json();
        let tag: string | null = null;
        try {
          const releaseResponse = await fetch(`${apiUrl}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
          if (releaseResponse.ok) {
            const release = await releaseResponse.json();
            tag = release.tag_name ?? null;
          }
        } catch { /* 标签获取失败时回退到本地版本号 */ }
        if (!cancelled) {
          setInfo({ stars: repo.stargazers_count ?? 0, forks: repo.forks_count ?? 0, tag });
        }
      } catch { /* 离线或限流时仅显示仓库名称 */ }
    })();
    return () => { cancelled = true; };
  }, [apiUrl]);
  return info;
}

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="链上开奖首页">
      <span className="brand-mark"><Blocks size={20} /></span>
      <span>链上开奖</span>
    </Link>
  );
}

function SiteHeader() {
  const repoInfo = useRepoInfo(REPO_API_URL);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        {SOURCE_REPO_URL ? (
          <a className="repo-link" href={SOURCE_REPO_URL} target="_blank" rel="noreferrer" title={REPO_NAME ? `GitHub · ${REPO_NAME}` : 'GitHub'}>
            <span className="repo-mark" aria-hidden="true"><Github size={15} /></span>
            <span className="repo-name">{REPO_NAME}</span>
            <span className="repo-stats">
              <span className="repo-stat"><Tag size={13} /> {repoInfo?.tag ?? `v${pkg.version}`}</span>
              {repoInfo && <span className="repo-stat"><Star size={13} /> {formatRepoCount(repoInfo.stars)}</span>}
              {repoInfo && <span className="repo-stat"><GitFork size={13} /> {formatRepoCount(repoInfo.forks)}</span>}
            </span>
          </a>
        ) : (
          <span className="source-link is-disabled" title="源代码即将开放">
            <Github size={17} /> 源代码即将开放
          </span>
        )}
      </div>
    </header>
  );
}

function BlockVisual() {
  return (
    <div className="block-visual" aria-hidden="true">
      <div className="visual-hud hud-top"><span>ETH / MAINNET</span><b>BLOCK STREAM</b></div>
      <div className="visual-hud hud-bottom"><span>SHA-256 CHAIN</span><b>VERIFIABLE</b></div>
      <div className="hash-stream hash-stream-a">0xf1a7c2 · 4b98de · 01cfa4 · e7d220</div>
      <div className="hash-stream hash-stream-b">a41b02 · 76e8fc · c3d914 · 28a7ef</div>
      <div className="chain-floor">
        {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
      </div>
      <div className="eth-orbit"><i /><i /></div>
      <div className="eth-gem"><i /><i /><i /><i /></div>
      <div className="audit-seal"><CheckCircle2 size={18} /><span>可复算</span></div>
    </div>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [confirmNewDraw, setConfirmNewDraw] = useState(false);
  const beginDraw = () => {
    if (hasUnfinishedDraw()) {
      setConfirmNewDraw(true);
      return;
    }
    startNewDraw();
    navigate('/draw/setup');
  };
  const confirmBeginDraw = () => {
    startNewDraw();
    setConfirmNewDraw(false);
    navigate('/draw/setup');
  };
  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={15} /> 基于 Ethereum Mainnet</span>
            <h1>链上开奖</h1>
            <p>让一个尚未产生的区块，决定这一次的中奖结果。</p>
            <div className="hero-actions">
              <button className="button button-primary button-large" onClick={beginDraw}>
                发起抽奖 <ArrowRight size={19} />
              </button>
              <Link className="button button-quiet button-large" to="/verify">验证结果</Link>
            </div>
            <div className="trust-row">
              <span><ShieldCheck size={17} /> 无需登录</span>
              <span><CheckCircle2 size={17} /> 结果可复算</span>
              <span><Blocks size={17} /> 主网区块哈希</span>
            </div>
          </div>
          <BlockVisual />
        </div>
        <div className="hero-next">
          <span>一次完整开奖</span>
          <strong>锁定名单</strong><i />
          <strong>等待区块</strong><i />
          <strong>公开验证</strong>
        </div>
      </section>
      <section className="principles">
        <div className="section-heading">
          <span className="section-kicker">公开，不靠口头承诺</span>
          <h2>每一步都有据可查</h2>
        </div>
        <div className="principle-grid">
          <article><span>01</span><h3>事先锁定</h3><p>名单、奖项和未来区块高度一经确认，必须重新发起才能修改。</p></article>
          <article><span>02</span><h3>链上取数</h3><p>等待以太坊主网目标区块产生，并经过两个后继区块确认。</p></article>
          <article><span>03</span><h3>随时复验</h3><p>下载公证凭证，任何人都能用相同输入重新计算结果。</p></article>
        </div>
      </section>
      {confirmNewDraw && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setConfirmNewDraw(false)}><section className="new-draw-dialog" role="dialog" aria-modal="true" aria-labelledby="new-draw-title" onMouseDown={(event) => event.stopPropagation()}><span className="dialog-signal"><Blocks size={22} /></span><span className="section-kicker">检测到未完成流程</span><h2 id="new-draw-title">放弃当前抽奖并重新发起？</h2><p>当前区块高度等待进度将被清除，参与者与奖项模板会保留，进入配置页后仍可修改。</p><div><button className="button button-quiet" onClick={() => setConfirmNewDraw(false)}>继续当前流程</button><button className="button button-primary" onClick={confirmBeginDraw}>确认发起新抽奖</button></div></section></div>}
    </main>
  );
}

function Placeholder() {
  return <main className="page-shell"><div className="empty-state"><Blocks size={34} /><h1>功能正在接入</h1></div></main>;
}

export function App() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/draw/setup" element={<SetupPage />} />
        <Route path="/draw/algorithm" element={<AlgorithmPage />} />
        <Route path="/draw/lock" element={<LockPage />} />
        <Route path="/draw/wait" element={<WaitPage />} />
        <Route path="/draw/calculate" element={<CalculatePage />} />
        <Route path="/draw/result" element={<ResultPage />} />
        <Route path="/draw/*" element={<Placeholder />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
