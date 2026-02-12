import { useRef } from 'react';
import type { SpecialPriceData } from '../types';
import { parseSpecialPriceFile } from '../logic/specialPriceParser';

interface Props {
  data: SpecialPriceData | null;
  onDataChanged: (data: SpecialPriceData | null) => void;
  /** Called when a general discount is detected in the file */
  onGeneralDiscountDetected: (discount: number) => void;
  disabled: boolean;
}

export function SpecialPriceUpload({ data, onDataChanged, onGeneralDiscountDetected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseSpecialPriceFile(file);
      onDataChanged(parsed);
      if (parsed.generalDiscount > 0) {
        onGeneralDiscountDetected(parsed.generalDiscount);
      }
    } catch (err) {
      alert(`Kunde inte läsa avtalsprisfil: ${err instanceof Error ? err.message : err}`);
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClear = () => {
    onDataChanged(null);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.txt"
        onChange={handleChange}
        id="special-price-input"
        className="hidden"
        disabled={disabled}
      />
      <label
        htmlFor="special-price-input"
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors cursor-pointer ${
          data
            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Avtalsprislista
      </label>
      {data && (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
            {data.entries.length} avtalspriser
            {data.generalDiscount > 0 && ` + ${data.generalDiscount}% övrigt`}
          </span>
          <button
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            onClick={handleClear}
            type="button"
          >
            Rensa
          </button>
        </>
      )}
    </div>
  );
}
