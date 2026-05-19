'use client';

import { Beaker, Bug, HelpCircle, Image, Puzzle, Plus, Zap } from 'lucide-react';
import { useState } from 'react';

// ────────────────────────────────────────────────────────────────────────────

type ActionId = 'plan' | 'debug' | 'ask' | 'image' | 'skills';

interface QuickAction {
  id: ActionId;
  label: string;
  icon: React.ReactNode;
  /** Template to insert into the input when selected. */
  promptTemplate: string;
}

const ACTIONS: QuickAction[] = [
  {
    id: 'plan',
    label: 'Plan',
    icon: <Zap size={14} />,
    promptTemplate: 'Create a plan for: ',
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: <Bug size={14} />,
    promptTemplate: 'Help me debug this issue:\n\n',
  },
  {
    id: 'ask',
    label: 'Ask',
    icon: <HelpCircle size={14} />,
    promptTemplate: '',
  },
  {
    id: 'image',
    label: 'Image',
    icon: <Image size={14} />,
    promptTemplate: 'Generate an image of: ',
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: <Puzzle size={14} />,
    promptTemplate: 'What skills are available for: ',
  },
];

// ────────────────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  onAction: (template: string) => void;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[26px] w-[26px] items-center justify-center rounded text-stone-500 transition-colors hover:bg-white/[0.06] hover:text-stone-200"
        title="Quick actions"
      >
        <Plus size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-8 left-0 z-40 w-44 rounded-lg border border-stone-200/20 bg-[#1e1e1e] py-1 shadow-xl">
            <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.1em] text-stone-500">
              Add agents, context, tools…
            </div>
            <div className="border-t border-stone-200/10" />
            {ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  onAction(action.promptTemplate);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-stone-300 transition-colors hover:bg-white/[0.06] hover:text-stone-100"
              >
                <span className="text-stone-500">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
