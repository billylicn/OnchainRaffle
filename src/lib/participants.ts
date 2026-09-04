import type { DrawConfiguration, Participant, ParticipantGridRow, Prize, ValidationIssue } from '../types/draw';

const ID_PATTERN = /^[1-9]\d*$/;
export type ParseResult = {
  participants: Participant[];
  issues: ValidationIssue[];
};

export function parseParticipantRows(rows: unknown[][]): ParseResult {
  const normalized = rows
    .map((row, index) => ({ row: index + 1, cells: row.slice(0, 2).map((cell) => String(cell ?? '').trim()) }))
    .filter(({ cells }) => cells.some(Boolean));
  const participants: Participant[] = [];
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();
  let numericIndex = 0;

  for (const entry of normalized) {
    const [id = '', name = ''] = entry.cells;
    if (!ID_PATTERN.test(id)) {
      issues.push({ row: entry.row, message: id ? '编号必须是不含前导零的正整数' : '编号不能为空' });
      continue;
    }
    numericIndex += 1;
    if (seen.has(id)) {
      issues.push({ row: entry.row, message: `编号 ${id} 重复，首次出现在第 ${seen.get(id)} 行` });
      continue;
    }
    seen.set(id, entry.row);
    const expectedId = String(numericIndex);
    if (id !== expectedId) {
      issues.push({ row: entry.row, message: `编号应为 ${expectedId}，名单必须从 1 连续递增` });
      continue;
    }
    participants.push({ id, ...(name ? { name } : {}) });
  }

  if (participants.length > 200) issues.push({ message: '名单模式最多支持 200 人' });
  if (!participants.length && !issues.length) issues.push({ message: '请至少导入一位参与者' });
  return { participants, issues };
}

export function parsePastedParticipants(text: string): ParseResult {
  const rows = text.split(/\r?\n/).map((line) => line.includes('\t') ? line.split('\t') : line.split(/[,，]/));
  return parseParticipantRows(rows);
}

export function normalizeGridRows(rows: unknown[][], minimumRows = 10): ParticipantGridRow[] {
  const normalized = rows
    .map((row) => ({
      id: String(row[0] ?? '').trim(),
      name: String(row[1] ?? '').trim(),
    }))
    .filter((row) => row.id || row.name);
  const limited = normalized.slice(0, 200);
  return [...limited, ...Array.from({ length: Math.max(0, minimumRows - limited.length) }, () => ({ id: '', name: '' }))];
}

function chineseNumber(value: number): string {
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (value < 10) return digits[value];
  if (value < 20) return `十${digits[value % 10]}`;
  if (value < 100) return `${digits[Math.floor(value / 10)]}十${digits[value % 10]}`;
  return String(value);
}

export function nextDefaultPrizeName(prizes: Prize[]): string {
  const names = new Set(prizes.map((prize) => prize.name.trim()));
  for (let level = 1; level <= 999; level += 1) {
    const name = `${chineseNumber(level)}等奖`;
    if (!names.has(name)) return name;
  }
  return `第${prizes.length + 1}等奖`;
}

export function validateRange(startValue: string, endValue: string): { start?: number; end?: number; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!ID_PATTERN.test(startValue.trim())) issues.push({ message: '起始编号必须是正整数' });
  if (!ID_PATTERN.test(endValue.trim())) issues.push({ message: '结束编号必须是正整数' });
  if (issues.length) return { issues };
  const start = Number(startValue);
  const end = Number(endValue);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) issues.push({ message: '编号超出安全整数范围' });
  else if (start !== 1) issues.push({ message: '数字模式编号必须从 1 开始' });
  else if (start > end) issues.push({ message: '起始编号不能大于结束编号' });
  else if (end - start + 1 > 5000) issues.push({ message: '数字范围最多支持 5000 人' });
  return { start, end, issues };
}

export function validatePrizes(prizes: Prize[], participantCount: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const names = new Set<string>();
  let total = 0;
  prizes.forEach((prize, index) => {
    const name = prize.name.trim();
    if (!name) issues.push({ row: index + 1, message: '奖项名称不能为空' });
    else if (name.length > 30) issues.push({ row: index + 1, message: '奖项名称最多 30 个字符' });
    else if (names.has(name)) issues.push({ row: index + 1, message: `奖项“${name}”重复` });
    names.add(name);
    if (!Number.isInteger(prize.count) || prize.count < 1) issues.push({ row: index + 1, message: '名额必须是正整数' });
    total += Number.isFinite(prize.count) ? prize.count : 0;
  });
  if (!prizes.length) issues.push({ message: '请至少设置一个奖项' });
  if (prizes.length > 20) issues.push({ message: '最多支持 20 个奖项' });
  if (total > participantCount) issues.push({ message: '中奖总名额不能超过参与人数' });
  return issues;
}

export function participantCount(configuration: DrawConfiguration): number {
  const spec = configuration.participantSpec;
  return spec.kind === 'list' ? spec.participants.length : spec.end - spec.start + 1;
}

export function participantIds(configuration: DrawConfiguration): string[] {
  const spec = configuration.participantSpec;
  if (spec.kind === 'list') return spec.participants.map(({ id }) => id);
  return Array.from({ length: spec.end - spec.start + 1 }, (_, index) => String(spec.start + index));
}
