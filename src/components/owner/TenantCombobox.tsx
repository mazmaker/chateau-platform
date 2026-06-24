import { useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ──────────────────────────────────────────────────────────────────────────
// Searchable company picker — drop-in replacement for the flat <Select> of
// tenants used across Owner pages. Type to filter (real-time) instead of
// scrolling a 20+ item list. Includes the "all" sentinel as the first option.
// ──────────────────────────────────────────────────────────────────────────

interface Option { id: string; name: string }

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  allLabel?: string;   // label for the "all companies" sentinel
  allValue?: string;   // value for the sentinel (default 'all')
  placeholder?: string;
  className?: string;   // applied to the trigger (e.g. "w-[200px]")
}

const TenantCombobox = ({
  value,
  onChange,
  options,
  allLabel = 'ทุกบริษัท',
  allValue = 'all',
  placeholder = 'เลือกบริษัท',
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo<Option[]>(() => [{ id: allValue, name: allLabel }, ...options], [options, allLabel, allValue]);
  const selectedName = all.find((o) => o.id === value)?.name ?? placeholder;
  const q = query.trim().toLowerCase();
  const filtered = q ? all.filter((o) => o.name.toLowerCase().includes(q)) : all;

  const choose = (id: string) => { onChange(id); setOpen(false); setQuery(''); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-9 px-3 text-sm flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-colors',
            className,
          )}
        >
          <span className="truncate text-left text-gray-900">{selectedName}</span>
          <ChevronsUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[260px] p-0" onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
        <div className="flex items-center gap-2 border-b border-gray-100 px-3">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && filtered.length > 0) choose(filtered[0].id); }}
            placeholder="ค้นหาบริษัท..."
            className="h-9 w-full text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">ไม่พบบริษัท</p>
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
                <span className="truncate text-gray-700">{o.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TenantCombobox;
