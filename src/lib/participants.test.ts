import { describe, expect, it } from 'vitest';
import { nextDefaultPrizeName, normalizeGridRows, parseParticipantRows, parsePastedParticipants, validatePrizes, validateRange } from './participants';

describe('participant parsing', () => {
  it('treats the first pasted row as participant data', () => {
    const result = parsePastedParticipants('编号\t姓名\n1\t李四\n2\t张三');
    expect(result.participants).toEqual([{ id: '1', name: '李四' }, { id: '2', name: '张三' }]);
    expect(result.issues).toEqual([{ row: 1, message: '编号必须是不含前导零的正整数' }]);
  });

  it('reports invalid and duplicate ids with row numbers', () => {
    const result = parsePastedParticipants('01\tA\n2\tB\n2\tC');
    expect(result.issues).toEqual([
      { row: 1, message: '编号必须是不含前导零的正整数' },
      { row: 2, message: '编号应为 1，名单必须从 1 连续递增' },
      { row: 3, message: '编号 2 重复，首次出现在第 2 行' },
    ]);
  });

  it('requires participant ids to start at one and increase continuously', () => {
    const result = parsePastedParticipants('1\tA\n3\tB\n2\tC');
    expect(result.issues).toEqual([
      { row: 2, message: '编号应为 2，名单必须从 1 连续递增' },
      { row: 3, message: '编号应为 3，名单必须从 1 连续递增' },
    ]);
  });

  it('limits imported lists to 200 people', () => {
    const rows = Array.from({ length: 201 }, (_, index) => [index + 1, '']);
    expect(parseParticipantRows(rows).issues.at(-1)?.message).toContain('200');
  });

  it('normalizes every spreadsheet row and keeps ten editable rows', () => {
    const rows = normalizeGridRows([['编号', '姓名'], ['', ''], ['2', '李四'], ['1', '张三']]);
    expect(rows.slice(0, 3)).toEqual([{ id: '编号', name: '姓名' }, { id: '2', name: '李四' }, { id: '1', name: '张三' }]);
    expect(rows).toHaveLength(10);
  });

  it('limits editable spreadsheet rows to 200 people', () => {
    const rows = normalizeGridRows(Array.from({ length: 205 }, (_, index) => [index + 1, `参与者${index + 1}`]));
    expect(rows).toHaveLength(200);
    expect(rows.at(-1)?.id).toBe('200');
  });
});

describe('configuration validation', () => {
  it('validates numeric ranges', () => {
    expect(validateRange('1', '5000').issues).toEqual([]);
    expect(validateRange('1', '5001').issues[0].message).toContain('5000');
    expect(validateRange('9', '10').issues[0].message).toContain('从 1 开始');
  });

  it('rejects duplicate prizes and excessive slots', () => {
    const issues = validatePrizes([
      { id: '1', name: '一等奖', count: 2 },
      { id: '2', name: '一等奖', count: 2 },
    ], 3);
    expect(issues.map(({ message }) => message)).toEqual(['奖项“一等奖”重复', '中奖总名额不能超过参与人数']);
  });

  it('limits prize names and prize categories for portable verification', () => {
    expect(validatePrizes([{ id: '1', name: '奖'.repeat(31), count: 1 }], 1)[0].message).toContain('30');
    expect(validatePrizes(Array.from({ length: 21 }, (_, index) => ({ id: String(index), name: `奖项${index}`, count: 1 })), 21).some(({ message }) => message.includes('20 个奖项'))).toBe(true);
  });

  it('chooses the next unused default prize name', () => {
    expect(nextDefaultPrizeName([{ id: '1', name: '一等奖', count: 1 }])).toBe('二等奖');
    expect(nextDefaultPrizeName([
      { id: '1', name: '一等奖', count: 1 },
      { id: '3', name: '三等奖', count: 1 },
    ])).toBe('二等奖');
  });
});
