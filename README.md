# 链上开奖

基于 Ethereum Mainnet 区块哈希的纯静态抽奖与公证网站。主办方先锁定参与者、奖项和未来区块高度；目标区块产生并经过两个后继区块确认后，浏览器执行公开、确定性的无放回抽取，并生成任何设备都能复算的 `DrawProofV3` 凭证。

## 使用链接（纯静态，托管于github）
https://billylicn.github.io/OnchainRaffle/

## 项目特点

- 纯静态前端：没有自建后端、数据库、账户系统、钱包或智能合约。
- 公开数字来源：使用预先锁定的 Ethereum Mainnet 未来区块哈希。
- 无偏且不重复：通过 rejection sampling 和 Partial Fisher-Yates 抽取。
- 完整复算：JSON 凭证和二维码包含重新计算结果所需的公开数据。
- 隐私隔离：姓名只保存在开奖设备本地，不进入算法、二维码或公开凭证。
- 桌面优先：面向现场大屏与电脑操作，同时适配 `390px` 级手机屏幕。

## 技术栈

- React 19、TypeScript、Vite、React Router HashRouter
- Noble Hashes：SHA-256
- Pako：凭证 Deflate 压缩
- `qrcode.react`：二维码
- SheetJS：按需导入 `.xlsx` / `.xls`
- Vitest：算法、校验、RPC、存储与凭证测试
- Playwright：桌面和移动端完整流程测试

## 快速开始

要求 Node.js `>= 20.19.0`。

```bash
git clone <your-repository-url>
cd chain-draw
npm ci
npm run dev
```

Vite 启动后会在终端显示本地访问地址。

常用命令：

```bash
npm run dev        # 启动开发服务器
npm test           # 运行 Vitest
npm run test:watch # 监听模式运行 Vitest
npm run test:e2e   # 运行 Playwright
npm run build      # 类型检查并生成 dist/
npm run preview    # 本地预览生产构建
```

## 环境变量

复制 `.env.example` 为 `.env.local`，按需配置：

```bash
VITE_SOURCE_REPO_URL=https://github.com/owner/repository
```

配置后，页头和公证页会显示源代码入口；未配置时显示“源代码即将开放”。所有 `VITE_` 变量都会进入浏览器构建产物，禁止填写密钥或其他秘密信息。

## 使用流程

1. 在网页双列表格中编辑编号和姓名，或粘贴 Excel 前两列，也可以导入 `.xlsx` / `.xls` 后继续修改。
2. 名单编号必须从 `1` 连续递增。名单模式最多 200 人；数字编号模式只填写参与总人数，最多 5000 人。
3. 设置有序奖项和名额。最多 20 个奖项，每个奖项名称最多 30 个字符，总名额不能超过参与人数。
4. 锁定时查询当前区块高度 `N`，将 `N + 2` 固定为目标区块高度。
5. 每 5 秒查询一次 Ethereum Mainnet。目标高度产生后，再等待两个后继区块确认。
6. 进入计算页后点击“开始运算”，逐个揭晓、自动运算，或直接开奖。动画和速度不改变结果。
7. 下载完整 JSON 凭证，或扫描完整复算二维码打开公证页。

## 抽奖算法

当前算法版本固定为 `CHAIN_DRAW_V1`。

1. `Seed₀` 是目标区块哈希去掉 `0x` 后对应的 32 字节数据。
2. 每个 Seed 使用前 60 个十六进制字符，每 6 位读取为一个 24 位无符号整数，共得到 10 个候选数字；末尾 4 个字符不参与本轮。
3. 当前 Seed 用完后计算 `Seedₙ₊₁ = SHA-256(Seedₙ)`，继续读取下一批候选数字。SHA-256 只负责确定性扩展，不是新的随机来源。
4. 剩余参与者数量为 `m` 时，计算 `limit = floor(2²⁴ / m) × m`。仅接受 `x < limit`，超出范围的候选数字直接跳过。
5. 对被接受的数字计算 `offset = x mod m`，再通过 Partial Fisher-Yates 从当前未中奖区域中选出对应编号。
6. 每次中奖后，该编号被交换到已抽取区域，不再参与后续抽取，因此不会重复中奖。

所有新抽奖编号固定为 `1...N`。姓名不参与候选数字、参与者摘要、交换位置或结果摘要的计算。

算法实现位于 `src/lib/algorithm.ts`，固定测试向量位于 `src/lib/algorithm.test.ts`。

## 公证凭证

当前仅生成和验证最新的 `DrawProofV3`。V1、V2 和旧摘要凭证不再兼容。

V3 记录：

- 凭证版本、`CHAIN_DRAW_V1` 和 Ethereum `chainId = 1`
- 目标区块高度、区块哈希、链上 Unix 时间戳和完成确认区块高度
- 参与者来源模式、参与总人数和参与者摘要
- 按开奖顺序排列的奖项名称与名额
- 结果摘要

V3 不记录姓名、完整编号数组、中奖编号数组、浏览器锁定时间或计算完成时间。验证页根据参与总人数重建 `1...N`，根据奖项顺序重建所有抽奖槽位，重新执行 `CHAIN_DRAW_V1`，最后核对结果摘要并展示重新计算出的中奖编号。

二维码链接使用 `/#/verify?proof=...`，凭证经 Deflate 压缩和 Base64URL 编码。当前所有二维码都是完整复算凭证，不使用摘要降级。

## 区块数据源

锁定页提供以下 Ethereum Mainnet JSON-RPC 数据源，默认使用 PublicNode；请求超时或失败时会自动切换：

- `https://ethereum-rpc.publicnode.com`
- `https://eth.llamarpc.com`
- `https://1rpc.io/eth`

也可以填写自定义 HTTPS RPC。节点必须返回 `eth_chainId = 0x1`，并支持：

- `eth_chainId`
- `eth_blockNumber`
- `eth_getBlockByNumber`

浏览器会直接请求 RPC，因此节点必须允许来自部署域名的 CORS 请求。静态站无法隐藏 RPC 密钥，不要配置需要保密的长期凭据。

## 静态部署

生产构建输出到 `dist/`。项目使用 Hash 路由和相对资源路径，无需服务器重写规则。

### GitHub Pages

仓库包含 `.github/workflows/deploy-pages.yml`。发布步骤：

1. 在 GitHub 仓库的 **Settings > Pages** 中选择 **GitHub Actions** 作为来源。
2. 打开 **Actions > Deploy GitHub Pages**。
3. 手动运行 `workflow_dispatch`。

工作流会执行 `npm ci`、`npm run build`，并自动把当前 GitHub 仓库地址写入 `VITE_SOURCE_REPO_URL`。部署工作流默认只允许手动触发，避免首次推送时意外公开站点。

### Cloudflare Pages

- Build command：`npm run build`
- Build output directory：`dist`
- Node.js：20.19 或更高版本
- 可选环境变量：`VITE_SOURCE_REPO_URL`

其他静态托管平台使用相同构建命令和输出目录即可。

## 本地数据与隐私

- 草稿、锁定会话、姓名和开奖结果保存在浏览器 `localStorage`。
- 姓名仅用于开奖设备本地展示，不进入二维码或 JSON 公证凭证。
- 清理浏览器站点数据会删除未导出的本地抽奖状态。
- “发起新抽奖”会清除上一轮冻结配置、锁定、确认和结果，但保留可复用的名单草稿、人数、奖项模板与自定义 RPC。
- 不要将真实名单、姓名、私有 RPC 或真实活动凭证提交到公开 Issue、测试夹具或截图。

## 公平性边界

本项目提供的是公开可复算，不是链上事前承诺。它可以证明同一参与总人数、奖项配置和区块哈希必然得到同一结果，但纯静态网站无法独立证明主办方在目标区块产生前已经公开承诺名单，也无法阻止主办方私下发起多轮抽奖后只发布其中一次。

现场公开锁定、全程录屏、由多方共同见证，或未来增加链上承诺机制，可以进一步减少选择性发布空间。项目不应宣称区块哈希能够解决所有开奖治理问题。

## 目录结构

```text
src/
  components/       流程导航等共享组件
  lib/              算法、名单、RPC、凭证、存储和测试
  pages/            设置、说明、锁定、等待、计算、结果与验证页面
  types/            抽奖领域类型和算法版本
e2e/                Playwright 完整流程测试
.github/             CI、Pages 部署和协作模板
```

## 开源协作

- 贡献方式见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
- 安全问题报告方式见 [SECURITY.md](./SECURITY.md)。
- 版本变更见 [CHANGELOG.md](./CHANGELOG.md)。
- 项目使用 [MIT License](./LICENSE)。

涉及 `CHAIN_DRAW_V1` 或 `DrawProofV3` 语义的改动必须升级协议版本，并提供固定测试向量；不能在原版本名下静默改变既有开奖结果或验证含义。
