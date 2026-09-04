import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Blocks,
  CheckCircle2,
  ChevronDown,
  CircleSlash2,
  Code2,
  GitBranch,
  Hash,
  Network,
  RefreshCw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DrawSteps } from '../components/DrawSteps';
import { loadConfiguration, loadLockedDraw } from '../lib/storage';

export function AlgorithmPage() {
  const navigate = useNavigate();
  const configuration = loadConfiguration();
  if (loadLockedDraw()) return <Navigate to="/draw/wait" replace />;
  if (!configuration) return <Navigate to="/draw/setup" replace />;

  return (
    <main className="page-shell draw-page algorithm-page algorithm-explainer">
      <DrawSteps active={1} />

      <header className="algorithm-intro">
        <span className="section-kicker">第 2 步 · 算法说明</span>
        <h1>任何设备重新执行都能得到相同结果</h1>
        <p className="algorithm-core-statement">用未来 Ethereum 区块哈希得到一串公开数字，作为随机洗牌算法的种子。每次从还没中奖的人中公平选择一个，中奖后移出待抽范围，直到完成所有名额。</p>
        <div className="algorithm-quick-path" aria-label="算法四步概览">
          <span><Blocks size={16} /> 未来区块提供公开数字</span>
          <ArrowRight size={16} />
          <span><Hash size={16} /> 固定规则持续读取</span>
          <ArrowRight size={16} />
          <span><ShieldCheck size={16} /> 不公平的数字跳过</span>
          <ArrowRight size={16} />
          <span><UserRoundCheck size={16} /> 中奖后退出后续抽取</span>
        </div>
      </header>

      <details className="plain-steps plain-steps-disclosure">
        <summary>
          <div className="algorithm-section-heading">
            <h2 id="plain-steps-title">四步完成公开抽取</h2>
            <p>每一步只做一件事，并且都能根据公开规则重新检查。</p>
          </div>
          <ChevronDown size={21} />
        </summary>

        <article className="plain-step-card">
          <div className="plain-step-copy">
            <span className="plain-step-number">01</span>
            <div>
              <small>开奖数字来源</small>
              <h3>① 获取未来区块哈希</h3>
              <p>主办方锁定一个尚未产生的 Ethereum 区块。区块产生后，其区块哈希成为本次抽奖的公开计算起点。</p>
              <ul className="plain-points">
                <li><CheckCircle2 size={15} /> 开奖使用公开链上数据</li>
                <li><CheckCircle2 size={15} /> 目标区块产生前，区块哈希无法提前读取</li>
                <li><CheckCircle2 size={15} /> 所有人都可以查询同一个区块哈希</li>
                <li><CircleSlash2 size={15} /> 浏览器不会另外生成随机数</li>
              </ul>
            </div>
          </div>
          <div className="source-ladder" aria-label="Ethereum 目标区块生成初始 Seed">
            <span><Network size={19} /><small>Ethereum Mainnet</small><strong>目标区块</strong></span>
            <ArrowDown size={17} />
            <span><Hash size={19} /><small>公开链上数据</small><strong>区块哈希</strong></span>
            <ArrowDown size={17} />
            <span className="is-seed"><Sparkles size={19} /><small>计算起点</small><strong>Seed₀</strong></span>
          </div>
        </article>

        <article className="plain-step-card seed-step-card">
          <div className="plain-step-copy">
            <span className="plain-step-number">02</span>
            <div>
              <small>固定规则扩展</small>
              <h3>② 从哈希中持续取得数字</h3>
              <p>系统按照固定规则读取区块哈希中的数字。当前 Seed 中的数字使用完后，再通过 SHA-256 从当前 Seed 确定性派生下一轮 Seed，继续读取。</p>
              <div className="deterministic-note"><RefreshCw size={16} /><span><strong>SHA-256 不是重新随机。</strong>它只是按照公开规则继续扩展数字序列，相同 Seed 永远得到相同结果。</span></div>
            </div>
          </div>
          <div className="seed-reading-flow" aria-label="Seed 确定性派生流程">
            <div className="seed-column"><strong>Seed₀</strong><i /><span>候选数字</span><i /><span>候选数字</span><i /><span>持续读取</span></div>
            <div className="seed-derive"><small>使用完</small><ArrowRight size={18} /><b>SHA-256</b><ArrowRight size={18} /></div>
            <div className="seed-column"><strong>Seed₁</strong><i /><span>候选数字</span><i /><span>候选数字</span><i /><span>继续读取</span></div>
            <div className="seed-derive"><small>再使用完</small><ArrowRight size={18} /><b>SHA-256</b><ArrowRight size={18} /></div>
            <div className="seed-column is-future"><strong>Seed₂</strong><i /><span>继续读取</span><i /><span>……</span></div>
          </div>
          <div className="seed-facts"><span>每 6 个十六进制字符 → 1 个 24 位整数</span><span>每个 Seed 使用前 60 个十六进制字符 → 10 个候选数字</span></div>
        </article>

        <article className="plain-step-card fairness-step-card">
          <div className="plain-step-copy">
            <span className="plain-step-number">03</span>
            <div>
              <small>拒绝采样</small>
              <h3>③ 消除取模偏差</h3>
              <p>剩余人数不一定能够整除所有可能的候选数字。如果直接取余数，某些位置可能会比其他位置多对应几个数字，从而产生极小的概率差异。</p>
              <p>系统先计算一个能够被当前剩余人数整除的有效范围。只有落在这个范围内的候选数字才会使用；超出范围的数字直接跳过，继续读取下一个候选数字。</p>
            </div>
          </div>
          <div className="fair-range-visual" aria-label="公平范围和跳过范围">
            <div className="fair-range-bar"><span>可公平平均分配</span><span>不使用</span></div>
            <div className="fair-range-labels"><span>使用</span><span>跳过</span></div>
          </div>
          <div className="candidate-decision" aria-label="候选数字判断流程">
            <span className="decision-source"><Hash size={17} /> 候选数字</span>
            <ArrowRight size={17} />
            <strong>是否位于公平范围？</strong>
            <GitBranch size={19} />
            <div><span><CheckCircle2 size={15} /> 是：计算对应位置</span><span><CircleSlash2 size={15} /> 否：跳过并读取下一个</span></div>
          </div>
          <p className="fairness-emphasis">被采用的候选数字可以平均映射到所有剩余位置，因此不会因为普通取模产生概率偏差。</p>
          <details className="calculation-rules">
            <summary><Code2 size={16} /> 查看计算规则 <ChevronDown size={16} /></summary>
            <pre>{'m = 当前剩余参与者数量\n\nlimit = floor(2²⁴ / m) × m\n\nx < limit   → 接受\nx ≥ limit   → 跳过，读取下一个候选数字\n\noffset = x mod m'}</pre>
          </details>
        </article>

        <article className="plain-step-card draw-step-card">
          <div className="plain-step-copy">
            <span className="plain-step-number">04</span>
            <div>
              <small>无放回抽取</small>
              <h3>④ 中奖后移出待抽范围</h3>
              <p>每产生一个有效位置，系统就在当前尚未中奖的编号中选出对应编号。</p>
              <p>中奖编号随后被移出后续可选择范围，因此之后的开奖只会在剩余编号中继续。</p>
            </div>
          </div>
          <div className="abstract-draw" aria-label="中奖编号移出待抽范围">
            <div className="abstract-pool before"><span>待抽</span><span>待抽</span><span className="is-selected">待抽</span><span>待抽</span></div>
            <div className="abstract-selected"><ArrowDown size={17} /><strong>被选中</strong></div>
            <div className="abstract-pool after"><span>待抽</span><span>待抽</span><span>待抽</span><i /><span className="is-winner">已中奖</span></div>
            <small>下一轮只在“待抽”区域中继续</small>
          </div>
          <div className="partial-fisher-note"><Shuffle size={18} /><p>实际实现通过交换数组位置完成，不需要反复删除名单。这种无放回选择方式属于 <strong>Partial Fisher-Yates</strong>。</p></div>
          <p className="no-repeat-emphasis">已经中奖的编号不会再次进入后续抽取范围。</p>
        </article>
      </details>

      <section className="technical-section" aria-labelledby="technical-title">
        <details>
          <summary><div><span>技术细节</span><h2 id="technical-title">完整 CHAIN_DRAW_V1 规则</h2><p>逐项说明输入、候选数字、拒绝采样与无放回抽取的执行顺序。</p></div><ChevronDown size={21} /></summary>
          <div className="technical-content">
            <ol>
              <li>
                <strong>固定输入与顺序</strong>
                <p>算法版本固定为 <code>CHAIN_DRAW_V1</code>。参与者数组 <code>P</code> 只保存从 1 连续递增的编号；参与总人数为 <code>N</code> 时，数组固定为 <code>1...N</code>。姓名仅用于本机展示，不进入数组，也不参与摘要或随机计算。</p>
                <p>奖项按照页面顺序展开为中奖槽位；每个奖项有多少名额，就连续生成多少个同名槽位。算法依次计算这些槽位，因此奖项顺序和名额都是复算输入的一部分。</p>
              </li>
              <li>
                <strong>读取初始 Seed</strong>
                <p>目标 Ethereum 区块哈希必须是 <code>0x</code> 加 64 个十六进制字符。移除 <code>0x</code> 后，将其按十六进制还原为原始 32 字节，得到 <code>Seed₀</code>；这里使用的是哈希字节本身，不是把哈希文本当作普通字符串编码。</p>
              </li>
              <li>
                <strong>生成候选数字流</strong>
                <p>每个 Seed 从第 1 个字节开始读取前 30 字节，并按顺序每 3 字节分成一组。每组以大端序解释为一个 24 位无符号整数，也就是 <code>UInt24BE</code>，取值范围为 <code>0</code> 到 <code>2²⁴ - 1</code>。</p>
                <p>30 字节正好产生 10 个候选数字。Seed 最后的 2 字节，也就是最后 4 个十六进制字符，在该轮不参与候选数字计算。</p>
              </li>
              <li>
                <strong>候选数字不足时继续派生</strong>
                <pre>{'Seedₙ₊₁ = SHA-256(Seedₙ)'}</pre>
                <p>当前 Seed 的 10 个候选数字全部读取后，对当前 32 字节 Seed 直接执行一次 SHA-256，所得 32 字节作为下一轮 Seed，再按同样方式读取前 30 字节。这个过程可持续重复，直到所有中奖槽位完成。</p>
                <p>SHA-256 只负责确定性扩展候选数字序列，不会引入新的外部随机来源；相同的当前 Seed 必然派生出相同的下一轮 Seed。</p>
              </li>
              <li>
                <strong>计算当前可公平使用的范围</strong>
                <p>设当前正在计算第 <code>i</code> 个中奖槽位，数组总长度为 <code>P.length</code>，尚未中奖的编号数量为 <code>m = P.length - i</code>。对读到的候选数字 <code>x</code>，计算：</p>
                <pre>{'limit = floor(2²⁴ / m) × m'}</pre>
                <p><code>limit</code> 是不超过 <code>2²⁴</code> 且能够被 <code>m</code> 整除的最大边界，因此从 <code>0</code> 到 <code>limit - 1</code> 的所有数字可以平均映射到当前全部待抽位置。</p>
              </li>
              <li>
                <strong>执行 rejection sampling</strong>
                <pre>{'x < limit   → 接受\nx ≥ limit   → 跳过并读取下一个候选数字'}</pre>
                <p>被跳过的候选数字不会产生中奖者，也不会推进中奖槽位，参与者数组保持不变。只有候选数字被接受后，才计算 <code>offset = x mod m</code>。因为有效范围可以被 <code>m</code> 整除，每个余数对应的候选数字数量完全相同。</p>
              </li>
              <li>
                <strong>在待抽区域定位中奖编号</strong>
                <pre>{'offset = x mod m\nj = i + offset\nswap(P[i], P[j])\n中奖编号 = P[i]'}</pre>
                <p><code>offset</code> 的范围是 <code>0</code> 到 <code>m - 1</code>，所以 <code>j</code> 必定位于当前待抽区域。算法交换 <code>P[i]</code> 与 <code>P[j]</code> 后，将 <code>P[i]</code> 记录为当前奖项槽位的中奖编号。</p>
                <p>随后 <code>i</code> 增加 1：数组前方已经完成的区域不再参与计算，后方待抽区域继续用于下一名中奖者。这就是 <code>Partial Fisher-Yates</code>，保证同一编号不会重复中奖。</p>
              </li>
              <li>
                <strong>形成可复算结果</strong>
                <p>算法持续读取候选数字，直到全部奖项槽位都有中奖编号。目标区块哈希、有序参与编号、奖项顺序与名额、算法版本相同时，候选数字的读取、接受或跳过、数组交换和最终中奖结果都会完全相同。</p>
                <p>页面动画速度、手动或自动揭晓、浏览器设备和姓名均不改变上述计算。算法不调用 <code>Math.random()</code>，也不向后台服务器请求另一组随机数。</p>
              </li>
            </ol>
          </div>
        </details>
      </section>

      <div className="page-actions"><button className="button button-quiet button-large" onClick={() => navigate('/draw/setup')}><ArrowLeft size={18} /> 返回修改</button><button className="button button-primary button-large" onClick={() => navigate('/draw/lock')}>选择未来区块高度 <ArrowRight size={18} /></button></div>
    </main>
  );
}
