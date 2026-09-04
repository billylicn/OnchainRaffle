import { expect, test, type Page } from '@playwright/test';
import { participantDigest, runDraw } from '../src/lib/algorithm';
import { createFullProof, encodeProof } from '../src/lib/proof';
import { ALGORITHM_VERSION, type DrawConfiguration, type DrawResult } from '../src/types/draw';

test.setTimeout(90_000);

const blockHash = `0x${'0123456789abcdef'.repeat(4)}`;
const blockTimestamp = 1_788_480_000;
const configuration: DrawConfiguration = {
  participantSpec: {
    kind: 'list',
    participants: [
      { id: '1', name: '张三' },
      { id: '2', name: '李四' },
      { id: '3', name: '王五' },
      { id: '4', name: '赵六' },
    ],
  },
  prizes: [{ id: 'first', name: '一等奖', count: 1 }, { id: 'second', name: '二等奖', count: 2 }],
};
const calculated = runDraw(configuration, blockHash);
const result: DrawResult = {
  algorithmVersion: ALGORITHM_VERSION,
  chainId: 1,
  configuration,
  participantDigest: participantDigest(configuration),
  headAtLock: 22_000_000,
  targetBlock: 22_000_002,
  confirmationBlock: 22_000_004,
  lockedAt: '2026-09-04T04:00:00.000Z',
  blockHash,
  targetBlockTimestamp: blockTimestamp,
  confirmedHead: 22_000_004,
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  ...calculated,
  completedAt: '2026-09-04T04:01:00.000Z',
};

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function pasteGrid(page: Page, value: string) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate((text) => navigator.clipboard.writeText(text), value);
  await page.getByLabel('第 1 行编号').click();
  await page.keyboard.press('ControlOrMeta+V');
}

async function installRpcMock(page: Page, height = result.targetBlock) {
  await page.route('https://ethereum-rpc.publicnode.com/**', async (route) => {
    const method = route.request().postDataJSON().method as string;
    const rpcResult = method === 'eth_chainId'
      ? '0x1'
      : method === 'eth_blockNumber'
        ? `0x${height.toString(16)}`
        : { hash: blockHash, timestamp: `0x${blockTimestamp.toString(16)}` };
    await route.fulfill({ json: { jsonrpc: '2.0', id: 1, result: rpcResult } });
  });
}

test('desktop spreadsheet setup validates continuous ids and explains the algorithm', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: '链上开奖' })).toBeVisible();
  await page.getByRole('button', { name: /发起抽奖/ }).click();

  await expect(page.getByRole('grid', { name: '参与者名单表格' })).toBeVisible();
  await expect(page.getByText('第一行是表头')).toHaveCount(0);
  await expect(page.locator('.participant-grid-head > span')).toHaveCount(3);
  await expect(page.locator('.participant-grid-head > span').first()).toHaveText('编号');
  await pasteGrid(page, '1\t张三\n2\t李四\n3\t王五\n4\t赵六');
  await expect(page.getByText('数据检查通过')).toBeVisible();

  await page.getByRole('button', { name: '添加奖项' }).click();
  await expect(page.locator('.prize-row').nth(1).getByLabel('奖项名称')).toHaveValue('二等奖');
  await page.getByLabel('第 2 行编号').fill('7');
  await expect(page.getByText(/编号应为 2/).first()).toBeVisible();
  await page.getByLabel('第 2 行编号').fill('2');
  await expect(page.getByText('数据检查通过')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/setup-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /了解抽奖算法/ }).click();
  await expect(page.getByText('第 2 步 · 算法说明', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '任何设备重新执行都能得到相同结果' })).toBeVisible();
  await expect(page.getByText(/用未来 Ethereum 区块哈希得到一串公开数字，作为随机洗牌算法的种子/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '① 获取未来区块哈希' })).not.toBeVisible();
  await page.getByText('四步完成公开抽取', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '① 获取未来区块哈希' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '② 从哈希中持续取得数字' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '③ 消除取模偏差' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '④ 中奖后移出待抽范围' })).toBeVisible();
  await expect(page.getByText('Ethereum Mainnet', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/SHA-256 不是重新随机/)).toBeVisible();
  await expect(page.getByText('先讲人话', { exact: true })).toHaveCount(0);
  await expect(page.getByText('四个环节共同保证计算一致', { exact: true })).toHaveCount(0);
  await expect(page.getByText('整个计算过程是确定性的', { exact: true })).toHaveCount(0);
  await expect(page.getByText('公平性边界', { exact: true })).toHaveCount(0);
  await page.getByText('完整 CHAIN_DRAW_V1 规则', { exact: true }).click();
  await expect(page.getByText('固定输入与顺序', { exact: true })).toBeVisible();
  await expect(page.getByText('候选数字不足时继续派生', { exact: true })).toBeVisible();
  await expect(page.getByText('在待抽区域定位中奖编号', { exact: true })).toBeVisible();
  await expect(page.getByText(/算法不调用/)).toBeVisible();
  await expect(page.getByRole('button', { name: /模拟开奖/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/algorithm-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /选择未来区块高度/ }).click();
  await expect(page.getByRole('heading', { name: '区块数据源选择' })).toBeVisible();
  await expect(page.getByText('高级节点设置', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(4);
  await expect(page.getByRole('radio', { name: /PublicNode/ })).toBeChecked();
  await expect(page.getByLabel('自定义 Ethereum Mainnet RPC')).toHaveCount(0);
  await page.getByText('自定义 RPC', { exact: true }).click();
  await expect(page.getByLabel('自定义 Ethereum Mainnet RPC')).toBeVisible();
  await page.getByText('LlamaRPC', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /LlamaRPC/ })).toBeChecked();
  await page.getByText('PublicNode', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /PublicNode/ })).toBeChecked();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/lock-desktop.png', fullPage: true });
});

test('headers are data rather than an automatically skipped first row', async ({ page }) => {
  await page.goto('/#/draw/setup');
  await pasteGrid(page, '编号\t姓名\n1\t张三');
  await expect(page.getByText('第 1 行：编号必须是不含前导零的正整数')).toBeVisible();
  await expect(page.getByText('数据检查通过')).toHaveCount(0);
});

test('mobile setup remains inside a 390px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/');
  await page.getByRole('button', { name: /发起抽奖/ }).click();
  await page.getByRole('button', { name: /数字编号/ }).click();
  await page.getByLabel('参与总人数').fill('5000');
  await expect(page.getByText('数据检查通过')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/setup-mobile.png', fullPage: true });
  await page.getByRole('button', { name: /了解抽奖算法/ }).click();
  await expect(page.getByText('第 2 步 · 算法说明', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '任何设备重新执行都能得到相同结果' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/algorithm-mobile.png', fullPage: true });
  await page.getByRole('button', { name: /选择未来区块高度/ }).click();
  await expect(page.getByRole('heading', { name: '区块数据源选择' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /PublicNode/ })).toBeChecked();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/lock-mobile.png', fullPage: true });
});

test('unfinished and completed draws start a genuinely new editable round', async ({ page }) => {
  await page.goto('/#/');
  await page.evaluate((fixture) => {
    localStorage.setItem('chain-draw:locked:v1', JSON.stringify({
      algorithmVersion: fixture.algorithmVersion,
      chainId: fixture.chainId,
      configuration: fixture.configuration,
      participantDigest: fixture.participantDigest,
      headAtLock: fixture.headAtLock,
      targetBlock: fixture.targetBlock,
      confirmationBlock: fixture.confirmationBlock,
      lockedAt: fixture.lockedAt,
    }));
  }, result);
  await page.reload();
  await page.getByRole('button', { name: /发起抽奖/ }).click();
  await expect(page.getByRole('dialog', { name: '放弃当前抽奖并重新发起？' })).toBeVisible();
  await page.getByRole('button', { name: '继续当前流程' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.evaluate((fixture) => {
    localStorage.setItem('chain-draw:draft:v1', JSON.stringify({
      mode: 'list', participantRows: fixture.configuration.participantSpec.kind === 'list' ? fixture.configuration.participantSpec.participants.map((participant) => ({ id: participant.id, name: participant.name ?? '' })) : [], rangeStart: '1', rangeEnd: '100', prizes: fixture.configuration.prizes,
    }));
    localStorage.setItem('chain-draw:result:v1', JSON.stringify(fixture));
  }, result);
  await page.reload();
  await page.getByRole('button', { name: /发起抽奖/ }).click();
  await expect(page).toHaveURL(/#\/draw\/setup$/u);
  await expect(page.getByLabel('第 1 行编号')).toHaveValue('1');
  await expect(page.getByLabel('第 1 行姓名')).toHaveValue('张三');
  expect(await page.evaluate(() => localStorage.getItem('chain-draw:result:v1'))).toBeNull();
});

test('waiting view emphasizes only the locked and target heights with timestamp', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installRpcMock(page);
  await page.goto('/#/');
  await page.evaluate((fixture) => {
    localStorage.setItem('chain-draw:locked:v1', JSON.stringify({
      algorithmVersion: fixture.algorithmVersion,
      chainId: fixture.chainId,
      configuration: fixture.configuration,
      participantDigest: fixture.participantDigest,
      headAtLock: fixture.headAtLock,
      targetBlock: fixture.targetBlock,
      confirmationBlock: fixture.confirmationBlock,
      lockedAt: fixture.lockedAt,
    }));
  }, result);
  await page.goto('/#/draw/wait');
  await expect(page.getByText('锁定时当前区块高度')).toBeVisible();
  await expect(page.getByText(`#${result.headAtLock.toLocaleString()}`)).toBeVisible();
  await expect(page.getByText(`#${result.targetBlock.toLocaleString()}`).first()).toBeVisible();
  await expect(page.getByLabel('等待确认 0/2')).toBeVisible();
  await expect(page.getByText('Unix 1788480000')).toBeVisible();
  await expect(page.getByText(`#${(result.targetBlock + 1).toLocaleString()}`)).toHaveCount(0);
  await expect(page.getByText(`#${(result.targetBlock + 2).toLocaleString()}`)).toHaveCount(0);
  await expect(page.getByText('下一次自动查询约在 5 秒内')).toHaveCount(0);
  await expect(page.getByText('链头')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/wait-desktop.png', fullPage: true });
});

test('calculation waits for a command and provides all reveal controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/');
  await page.evaluate((fixture) => localStorage.setItem('chain-draw:confirmed:v1', JSON.stringify(fixture)), result);
  await page.goto('/#/draw/calculate');
  await expect(page.getByRole('heading', { name: '正在公开计算中奖结果' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText('0 / 3 个结果已揭晓')).toBeVisible();
  await expect(page.getByRole('button', { name: /开始运算/ })).toBeEnabled();
  await expect(page.locator('.seed-segments .is-active')).toHaveCount(0);
  await expect(page.getByText('中奖编号 ••••')).toBeVisible();
  await expect(page.getByRole('button', { name: /自动运算剩余结果/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: '2x' })).toBeVisible();
  await expect(page.getByRole('button', { name: '5x' })).toBeVisible();
  await expect(page.getByRole('button', { name: /直接开奖/ })).toBeVisible();
  await expect(page.getByText(/计算已确定但不会自动开始/)).toHaveCount(0);
  await page.getByRole('button', { name: /开始运算/ }).click();
  await expect(page.getByRole('button', { name: /正在运算/ })).toBeDisabled();
  await expect(page.locator('.seed-segments .is-active')).toHaveCount(1);
  await expect(page.locator('.winner-blurred')).toBeVisible();
  await expect(page.getByText('0 / 3 个结果已揭晓')).toBeVisible();
  await expect(page.getByText('1 / 3 个结果已揭晓')).toBeVisible();
  await expect(page.getByRole('button', { name: /计算下一结果/ })).toBeEnabled();
  await expect(page.locator('.winner-blurred')).toHaveCount(0);
  await expect(page.getByText('正在使用的六位切片')).toBeVisible();
  await expect(page.getByText(/个待抽/)).toBeVisible();
  await expect(page.getByText(/中奖者位于待抽序列的第/)).toBeVisible();
  await expect(page.getByText('从待抽区域抽出')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/calculate-mobile.png', fullPage: true });
});

test('result proof includes the chain timestamp and verifies independently', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installRpcMock(page);
  await page.goto('/#/');
  await page.evaluate((fixture) => localStorage.setItem('chain-draw:result:v1', JSON.stringify(fixture)), result);
  await page.goto('/#/draw/result');
  await expect(page.getByRole('heading', { name: '中奖结果已确定' })).toBeVisible();
  await expect(page.locator('.winner-list article > div > strong').first()).toContainText('编号');
  await expect(page.locator('.winner-list .draw-order').first()).toContainText('第 1 次抽取');
  await expect(page.locator('.winner-list article > span')).toHaveCount(0);
  await expect(page.getByText('Unix 1788480000')).toBeVisible();
  await expect(page.getByText('完整复算二维码')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const proof = createFullProof(result);
  await page.goto(`/#/verify?proof=${encodeProof(proof)}`);
  await expect(page.getByText('算法复算一致')).toBeVisible();
  await expect(page.getByText('链上哈希已核对')).toBeVisible();
  await expect(page.getByRole('heading', { name: '为什么验证结果可信' })).toBeVisible();
  await expect(page.getByText('Ethereum Mainnet', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('4 人')).toBeVisible();
  await expect(page.getByText('Unix 1788480000')).toBeVisible();
  await expect(page.getByText('第 1 次抽取', { exact: true })).toBeVisible();
  await expect(page.getByText(`编号 ${result.winners[0].participantId}`, { exact: true }).last()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/verify-desktop.png', fullPage: true });
});

test('mobile result and verification remain readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installRpcMock(page);
  await page.goto('/#/');
  await page.evaluate((fixture) => localStorage.setItem('chain-draw:result:v1', JSON.stringify(fixture)), result);
  await page.goto('/#/draw/result');
  await expect(page.locator('.qr-frame svg')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/result-mobile.png', fullPage: true });

  await page.goto(`/#/verify?proof=${encodeProof(createFullProof(result))}`);
  await expect(page.getByText('算法复算一致')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/verify-mobile.png', fullPage: true });
});
