'use client';
import { passwordRules } from '@/lib/validation';
import { useChecklistFeedback } from '@/hooks/useFieldFeedback';

interface PasswordRequirementsChecklistProps {
  isRTL: boolean;
  value: string;
}

// Renders every currently-unmet password rule (red), stacked below one
// another; the instant a rule is satisfied it flashes green for a beat then
// disappears from the list. Rules that are already satisfied the first time
// they're observed never render at all — only ones that needed fixing show up.
export default function PasswordRequirementsChecklist({ isRTL, value }: PasswordRequirementsChecklistProps) {
  const rules = value ? passwordRules(isRTL, value) : [];
  const items = useChecklistFeedback(rules);

  if (items.length === 0) return null;

  return (
    <div className="mt-1 flex flex-col gap-0.5">
      {items.map((item) => (
        <p
          key={item.id}
          className="text-xs transition-colors duration-300"
          style={{ color: item.status === 'success' ? '#10b981' : '#ef4444' }}
        >
          {item.message}
        </p>
      ))}
    </div>
  );
}
