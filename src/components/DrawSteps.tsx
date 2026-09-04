import { Check } from 'lucide-react';

const STEPS = ['参与者与奖项', '算法说明', '锁定区块', '等待确认', '计算开奖', '结果公证'];

export function DrawSteps({ active }: { active: number }) {
  return (
    <nav className="draw-steps" aria-label="抽奖步骤">
      {STEPS.map((step, index) => (
        <div className={index === active ? 'is-active' : index < active ? 'is-done' : ''} key={step}>
          <span>{index < active ? <Check size={13} /> : index + 1}</span>
          <label>{step}</label>
        </div>
      ))}
    </nav>
  );
}
