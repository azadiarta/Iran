'use client';
import { useEffect, useRef, useState } from 'react';

// Shared real-time error lifecycle for every validated field, site-wide and
// admin-panel-wide: while a field is invalid its message shows in red; the
// instant it becomes valid the same message flashes green for a short beat
// (so the user sees what just got fixed) before clearing. Never flashes on
// first mount/untouched fields — only on a genuine error -> resolved transition.
export const FIELD_FEEDBACK_FLASH_MS = 1800;

export type FieldFeedbackStatus = 'idle' | 'error' | 'success';

export interface FieldFeedback {
  message: string | undefined;
  status: FieldFeedbackStatus;
}

export function useTransientError(error: string | undefined, duration: number = FIELD_FEEDBACK_FLASH_MS): FieldFeedback {
  const [state, setState] = useState<FieldFeedback>({
    message: error,
    status: error ? 'error' : 'idle',
  });
  const prevErrorRef = useRef<string | undefined>(error);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const previous = prevErrorRef.current;
    prevErrorRef.current = error;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (error) {
      setState({ message: error, status: 'error' });
      return;
    }

    if (previous) {
      // Just resolved: flash the last message green, then clear it.
      setState({ message: previous, status: 'success' });
      timerRef.current = setTimeout(() => {
        setState({ message: undefined, status: 'idle' });
        timerRef.current = null;
      }, duration);
      return;
    }

    setState({ message: undefined, status: 'idle' });
  }, [error, duration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return state;
}

// Multi-rule checklist version (used for password-strength, the only
// validator with several independently-failing conditions at once). Every
// currently-failing rule is shown (red) simultaneously, stacked. The moment a
// rule becomes satisfied it flashes green for the same beat, then disappears
// from the list entirely. A rule that is already satisfied the very first
// time it's observed (never seen failing) never renders at all — only rules
// that genuinely needed fixing get shown, whether still broken or just fixed.
export interface ChecklistRule {
  id: string;
  message: string;
  satisfied: boolean;
}

export interface ChecklistItem {
  id: string;
  message: string;
  status: 'error' | 'success';
}

export function useChecklistFeedback(rules: ChecklistRule[], duration: number = FIELD_FEEDBACK_FLASH_MS): ChecklistItem[] {
  const [, forceRender] = useState(0);
  const itemsRef = useRef<ChecklistItem[]>([]);
  const prevSatisfiedRef = useRef<Map<string, boolean>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const key = rules.map((r) => `${r.id}:${r.satisfied}`).join('|');

  useEffect(() => {
    const current = new Map(itemsRef.current.map((i) => [i.id, i]));
    for (const rule of rules) {
      const prevSatisfied = prevSatisfiedRef.current.get(rule.id);
      const existingTimer = timersRef.current.get(rule.id);

      if (!rule.satisfied) {
        if (existingTimer) {
          clearTimeout(existingTimer);
          timersRef.current.delete(rule.id);
        }
        current.set(rule.id, { id: rule.id, message: rule.message, status: 'error' });
      } else if (prevSatisfied === false) {
        current.set(rule.id, { id: rule.id, message: rule.message, status: 'success' });
        const timer = setTimeout(() => {
          itemsRef.current = itemsRef.current.filter((i) => i.id !== rule.id);
          timersRef.current.delete(rule.id);
          forceRender((n) => n + 1);
        }, duration);
        timersRef.current.set(rule.id, timer);
      }
      prevSatisfiedRef.current.set(rule.id, rule.satisfied);
    }

    itemsRef.current = rules
      .map((r) => current.get(r.id))
      .filter((item): item is ChecklistItem => !!item);
    forceRender((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return itemsRef.current;
}
