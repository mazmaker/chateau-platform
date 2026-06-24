import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ──────────────────────────────────────────────────────────────────────────
// Searchable person picker — drop-in replacement for the flat <Select> used to
// assign a salesperson to a lead. Type to filter by name / email (real-time)
// instead of scrolling a long list. Styled to match the shadcn <SelectTrigger>
// so it blends in with the other form fields. Mirror of TenantCombobox, but for
// people and without the "all" sentinel (a form field needs a real selection).
// ──────────────────────────────────────────────────────────────────────────

export interface UserOption { id: string; name: string; sub?: string }

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: UserOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;   // applied to the trigger (e.g. "mt-1.5 max-w-md")
}

const UserCombobox = ({
  value,
  onChange,
  options,
  placeholder = 'เลือกพนักงานขาย',
  searchPlaceholder = 'ค้นหาชื่อ...',
  emptyText = 'ไม่พบรายชื่อ',
  disabled = false,
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? options.filter((o) => o.name.toLowerCase().includes(q) || (o.sub || '').toLowerCase().includes(q)) : options),
    [options, q],
  );

  const choose = (id: string) => { onChange(id); setOpen(false); setQuery(''); };

  return (
    <Popover open={open} onOpenChange={(o) => { if (disabled) return; setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate text-left', selected ? 'text-foreground' : 'text-muted-foreground')}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-[220px] p-0"
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-3">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && filtered.length > 0) choose(filtered[0].id); }}
            placeholder={searchPlaceholder}
            className="h-9 w-full text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{emptyText}</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(o.id)}
                className={cn(
                  'w-full flex items-center gap-2 text-left text-sm rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors',
                  o.id === value && 'bg-gray-50 font-medium',
                )}
              >
                <Check className={cn('w-4 h-4 flex-shrink-0 text-chateau', o.id === value ? 'opacity-100' : 'opacity-0')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-gray-700">{o.name}</span>
                  {o.sub && <span className="block truncate text-xs text-gray-400">{o.sub}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserCombobox;
