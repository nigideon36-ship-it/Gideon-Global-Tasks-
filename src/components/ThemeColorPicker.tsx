import React, { useState, useRef, useEffect } from 'react';
import { useTasks, ThemeColor } from '../context/TaskContext';
import { Palette, Check } from 'lucide-react';

interface ThemeOption {
  id: ThemeColor;
  label: string;
  sublabel: string;
  colorHex: string;
  dotClass: string;
}

const THEMES: ThemeOption[] = [
  {
    id: 'emerald',
    label: 'Emerald Fintech',
    sublabel: 'Cash Bounties & M-PESA',
    colorHex: '#059669',
    dotClass: 'bg-emerald-600'
  },
  {
    id: 'cobalt',
    label: 'Ocean Cobalt',
    sublabel: 'AI & Data Annotation',
    colorHex: '#2563eb',
    dotClass: 'bg-blue-600'
  },
  {
    id: 'violet',
    label: 'Cyber Violet',
    sublabel: 'Creative & Meme Studio',
    colorHex: '#7c3aed',
    dotClass: 'bg-purple-600'
  },
  {
    id: 'amber',
    label: 'Sunset Amber',
    sublabel: 'VIP Gold Contributor',
    colorHex: '#d97706',
    dotClass: 'bg-amber-600'
  },
  {
    id: 'rose',
    label: 'Ruby Rose',
    sublabel: 'High-Impact Editorial',
    colorHex: '#e11d48',
    dotClass: 'bg-rose-600'
  }
];

export const ThemeColorPicker: React.FC = () => {
  const { themeColor, setThemeColor } = useTasks();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTheme = THEMES.find((t) => t.id === themeColor) || THEMES[0];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
        title="Change Platform Theme Color"
        aria-label="Change Theme Color"
      >
        <Palette className="w-3.5 h-3.5 text-slate-600" />
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10"
          style={{ backgroundColor: currentTheme.colorHex }}
        />
        <span className="hidden lg:inline text-[11px] font-medium text-slate-600">
          Theme
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
            <span className="font-bold text-slate-800">Accent Theme Color</span>
            <span className="text-[10px] text-slate-400 font-mono">5 Palettes</span>
          </div>

          <div className="space-y-1">
            {THEMES.map((theme) => {
              const isSelected = themeColor === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setThemeColor(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-slate-100/90 text-slate-900 font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-xs ring-1 ring-black/10"
                      style={{ backgroundColor: theme.colorHex }}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {theme.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate leading-tight">
                        {theme.sublabel}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-slate-900 shrink-0 stroke-[2.5]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
