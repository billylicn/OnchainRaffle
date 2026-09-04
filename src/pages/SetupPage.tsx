import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { AlertCircle, ArrowRight, Eraser, FileSpreadsheet, List, Plus, Table2, Trash2, Upload, Users, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DrawSteps } from '../components/DrawSteps';
import { readSpreadsheet } from '../lib/excel';
import { nextDefaultPrizeName, normalizeGridRows, parseParticipantRows, validatePrizes, validateRange } from '../lib/participants';
import { loadDraft, loadLockedDraw, saveConfiguration, saveDraft } from '../lib/storage';
import type { DrawConfiguration, ParticipantGridRow, Prize, ValidationIssue } from '../types/draw';

export function SetupPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(loadDraft);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [gridMessage, setGridMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const locked = loadLockedDraw();

  useEffect(() => saveDraft(draft), [draft]);

  const listResult = useMemo(() => parseParticipantRows(draft.participantRows.map((row) => [row.id, row.name])), [draft.participantRows]);
  const rangeResult = useMemo(() => validateRange(draft.rangeStart, draft.rangeEnd), [draft.rangeStart, draft.rangeEnd]);
  const count = draft.mode === 'list'
    ? listResult.participants.length
    : rangeResult.start && rangeResult.end ? rangeResult.end - rangeResult.start + 1 : 0;
  const sourceIssues = draft.mode === 'list' ? listResult.issues : rangeResult.issues;
  const prizeIssues = validatePrizes(draft.prizes, count);
  const issues = [...sourceIssues, ...prizeIssues];
  const ready = count > 0 && issues.length === 0;
  if (locked) return <Navigate to="/draw/wait" replace />;

  const updatePrize = (id: string, patch: Partial<Prize>) => {
    setDraft((current) => ({ ...current, prizes: current.prizes.map((prize) => prize.id === id ? { ...prize, ...patch } : prize) }));
  };

  const setParticipantRows = (participantRows: ParticipantGridRow[]) => {
    setDraft((current) => ({ ...current, participantRows }));
  };

  const updateParticipantRow = (index: number, column: keyof ParticipantGridRow, value: string) => {
    setDraft((current) => ({
      ...current,
      participantRows: current.participantRows.map((row, rowIndex) => rowIndex === index ? { ...row, [column]: value } : row),
    }));
  };

  const handleGridPaste = (event: ClipboardEvent<HTMLInputElement>, startRow: number, startColumn: number) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !/[\r\n]/u.test(text)) return;
    event.preventDefault();
    const incoming = text.split(/\r?\n/u).filter((line, index, lines) => line || index < lines.length - 1).map((line) => line.split('\t').slice(0, 2));
    const available = 200 - startRow;
    if (incoming.length > available) setGridMessage(`名单最多支持 200 人，已保留前 ${available} 行。`);
    else setGridMessage(`已粘贴 ${incoming.length} 行，可继续逐格修改。`);
    const next = draft.participantRows.map((row) => ({ ...row }));
    incoming.slice(0, available).forEach((cells, rowOffset) => {
      const targetIndex = startRow + rowOffset;
      while (next.length <= targetIndex) next.push({ id: '', name: '' });
      if (startColumn === 0) {
        next[targetIndex] = { id: cells[0] ?? '', name: cells[1] ?? '' };
      } else {
        next[targetIndex] = { ...next[targetIndex], name: cells[0] ?? '' };
      }
    });
    setParticipantRows(next.slice(0, 200));
  };

  const moveOnEnter = (event: KeyboardEvent<HTMLInputElement>, row: number, column: 'id' | 'name') => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`[data-grid-cell="${row + 1}-${column}"]`);
    next?.focus();
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setFileError('');
    try {
      const rows = await readSpreadsheet(file);
      const nonEmpty = rows.filter((row) => row.slice(0, 2).some((cell) => String(cell ?? '').trim()));
      if (nonEmpty.length > 200) setGridMessage('名单最多支持 200 人，已保留前 200 行。');
      else setGridMessage(`已导入 ${nonEmpty.length} 行，可继续逐格修改。`);
      setParticipantRows(normalizeGridRows(rows));
      setFileName(file.name);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : '无法读取该文件');
    }
  };

  const continueToAlgorithm = () => {
    if (!ready) return;
    const configuration: DrawConfiguration = draft.mode === 'list'
      ? { participantSpec: { kind: 'list', participants: listResult.participants }, prizes: draft.prizes.map((prize) => ({ ...prize, name: prize.name.trim() })) }
      : { participantSpec: { kind: 'range', start: rangeResult.start!, end: rangeResult.end! }, prizes: draft.prizes.map((prize) => ({ ...prize, name: prize.name.trim() })) };
    saveConfiguration(configuration);
    navigate('/draw/algorithm');
  };

  return (
    <main className="page-shell draw-page">
      <DrawSteps active={0} />
      <div className="page-title-row"><div><span className="section-kicker">第 1 步</span><h1>参与者与奖项</h1><p>导入编号，确认本次要抽出的奖项和名额。</p></div><div className="count-badge"><Users size={20} /><span><strong>{count}</strong> 位参与者</span></div></div>

      <section className="tool-section">
        <div className="section-label"><span>01</span><div><h2>参与者来源</h2><p>编号是唯一中奖身份，姓名只在本机展示。</p></div></div>
        <div className="segmented" role="tablist">
          <button className={draft.mode === 'list' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, mode: 'list' })}><List size={17} /> 导入名单</button>
          <button className={draft.mode === 'range' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, mode: 'range', rangeStart: '1' })}><Users size={17} /> 数字编号</button>
        </div>
        {draft.mode === 'list' ? (
          <div className="input-layout">
            <div>
              <div className="grid-toolbar"><div><Table2 size={17} /><strong>名单表格</strong><span>可从 Excel 直接粘贴两列</span></div><button className="button button-quiet grid-clear" onClick={() => { setParticipantRows(Array.from({ length: 10 }, () => ({ id: '', name: '' }))); setFileName(''); setGridMessage('表格已清空。'); }}><Eraser size={15} /> 清空</button></div>
              <div className="participant-grid" role="grid" aria-label="参与者名单表格">
                <div className="participant-grid-head" role="row"><span>编号</span><span>姓名</span><span /></div>
                {draft.participantRows.map((row, index) => {
                  const rowIssue = listResult.issues.find((issue) => issue.row === index + 1);
                  return <div className={`participant-grid-row ${rowIssue ? 'has-error' : ''}`} role="row" key={index} title={rowIssue?.message}>
                    <input aria-label={`第 ${index + 1} 行编号`} data-grid-cell={`${index}-id`} value={row.id} inputMode="numeric" placeholder={String(index + 1)} onPaste={(event) => handleGridPaste(event, index, 0)} onKeyDown={(event) => moveOnEnter(event, index, 'id')} onChange={(event) => updateParticipantRow(index, 'id', event.target.value)} />
                    <input aria-label={`第 ${index + 1} 行姓名`} data-grid-cell={`${index}-name`} value={row.name} placeholder={index === 0 ? '张三（可空）' : ''} onPaste={(event) => handleGridPaste(event, index, 1)} onKeyDown={(event) => moveOnEnter(event, index, 'name')} onChange={(event) => updateParticipantRow(index, 'name', event.target.value)} />
                    <button className="grid-delete" title={`删除第 ${index + 1} 行`} onClick={() => { const next = draft.participantRows.filter((_, rowIndex) => rowIndex !== index); setParticipantRows([...next, ...Array.from({ length: Math.max(0, 10 - next.length) }, () => ({ id: '', name: '' }))]); }}><X size={14} /></button>
                    {rowIssue && <small>{rowIssue.message}</small>}
                  </div>;
                })}
              </div>
              <div className="grid-footer"><button className="text-button" disabled={draft.participantRows.length >= 200} onClick={() => setParticipantRows([...draft.participantRows, { id: '', name: '' }])}><Plus size={14} /> 添加一行</button><span>{draft.participantRows.length} / 200 行</span></div>
              {gridMessage && <div className="grid-message">{gridMessage}</div>}
            </div>
            <div className="upload-panel">
              <FileSpreadsheet size={30} />
              <strong>{fileName || '导入 Excel 文件'}</strong>
              <span>.xlsx 或 .xls，读取首个工作表前两列</span>
              <input ref={fileInput} type="file" hidden accept=".xlsx,.xls" onChange={(event) => handleFile(event.target.files?.[0])} />
              <button className="button button-quiet" onClick={() => fileInput.current?.click()}><Upload size={16} /> 选择文件</button>
              {fileName && <span className="file-loaded">已载入表格，可在左侧继续编辑</span>}
              {fileError && <small className="error-text">{fileError}</small>}
            </div>
          </div>
        ) : (
          <div className="range-fields range-count-field"><div><span>编号规则</span><strong>从 1 连续递增</strong></div><label><span>参与总人数</span><input aria-label="参与总人数" value={draft.rangeEnd} inputMode="numeric" onChange={(event) => setDraft({ ...draft, rangeStart: '1', rangeEnd: event.target.value })} /></label></div>
        )}
      </section>

      <section className="tool-section">
        <div className="section-label"><span>02</span><div><h2>奖项设置</h2><p>按这里的顺序依次开奖。</p></div></div>
        <div className="prize-editor">
          {draft.prizes.map((prize, index) => (
            <div className="prize-row" key={prize.id}>
              <span className="drag-index">{String(index + 1).padStart(2, '0')}</span>
              <label><span>奖项名称</span><input value={prize.name} onChange={(event) => updatePrize(prize.id, { name: event.target.value })} /></label>
              <label className="count-field"><span>名额</span><input type="number" min="1" value={prize.count} onChange={(event) => updatePrize(prize.id, { count: Number(event.target.value) })} /></label>
              <button className="icon-button" title="删除奖项" disabled={draft.prizes.length === 1} onClick={() => setDraft({ ...draft, prizes: draft.prizes.filter((item) => item.id !== prize.id) })}><Trash2 size={17} /></button>
            </div>
          ))}
          <button className="add-row" onClick={() => setDraft({ ...draft, prizes: [...draft.prizes, { id: `prize-${Date.now()}`, name: nextDefaultPrizeName(draft.prizes), count: 1 }] })}><Plus size={17} /> 添加奖项</button>
        </div>
      </section>

      <section className={`validation-panel ${ready ? 'is-ready' : ''}`}>
        <div><strong>{ready ? '数据检查通过' : '请完成数据检查'}</strong><span>{ready ? `已导入 ${count} 人，共 ${draft.prizes.reduce((sum, prize) => sum + prize.count, 0)} 个中奖名额` : '修正下面的问题后即可继续'}</span></div>
        {!ready && <IssueList issues={issues.slice(0, 6)} />}
        {ready && <div className="prize-summary">{draft.prizes.map((prize) => <span key={prize.id}>{prize.name} {prize.count} 名</span>)}</div>}
      </section>
      <div className="page-actions"><LinkBack /><button className="button button-primary button-large" disabled={!ready} onClick={continueToAlgorithm}>了解抽奖算法 <ArrowRight size={18} /></button></div>
    </main>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  return <ul className="issue-list">{issues.map((issue, index) => <li key={`${issue.row}-${index}`}><AlertCircle size={15} />{issue.row ? `第 ${issue.row} 行：` : ''}{issue.message}</li>)}</ul>;
}

function LinkBack() {
  const navigate = useNavigate();
  return <button className="button button-quiet button-large" onClick={() => navigate('/')}>返回首页</button>;
}
