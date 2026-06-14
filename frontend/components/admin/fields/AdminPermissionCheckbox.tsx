'use client';
import { Check } from 'lucide-react';

import { PERMISSION_META } from '@/lib/permissionsMeta';

export interface PermissionOption {
  codename: string;
  label: string;
}

interface AdminPermissionCheckboxProps {
  permissions: PermissionOption[];
  selected: string[];
  onChange: (codenames: string[]) => void;
  alwaysOn?: string[];
  isRTL?: boolean;
}

export default function AdminPermissionCheckbox({
  permissions,
  selected,
  onChange,
  alwaysOn = ['can_contribute', 'can_comment'],
  isRTL = false,
}: AdminPermissionCheckboxProps) {
  function toggle(codename: string) {
    if (alwaysOn.includes(codename)) return;
    if (selected.includes(codename)) {
      onChange(selected.filter((c) => c !== codename));
    } else {
      onChange([...selected, codename]);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {permissions.map((perm) => {
        const locked = alwaysOn.includes(perm.codename);
        const checked = locked || selected.includes(perm.codename);

        return (
          <label
            key={perm.codename}
            onClick={() => toggle(perm.codename)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${locked ? 'cursor-default opacity-70' : 'cursor-pointer hover:bg-white/[0.04]'}`}
            style={{
              backgroundColor: checked ? 'rgba(0,255,255,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${checked ? 'rgba(0,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all"
              style={{
                backgroundColor: checked ? '#00ffff' : 'transparent',
                border: `1px solid ${checked ? '#00ffff' : 'rgba(255,255,255,0.3)'}`,
              }}
            >
              {checked && <Check className="w-3.5 h-3.5" style={{ color: '#0a0a0f' }} />}
            </span>
            <span className="text-sm text-white/80">
              {PERMISSION_META[perm.codename]
                ? (isRTL ? PERMISSION_META[perm.codename].label.fa : PERMISSION_META[perm.codename].label.en)
                : perm.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
