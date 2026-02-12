import type { PricingSettings } from '../types';

interface Props {
  settings: PricingSettings;
  onChange: (settings: PricingSettings) => void;
  disabled: boolean;
  hasSpecialPrices: boolean;
}

export function PriceSettings({ settings, onChange, disabled, hasSpecialPrices }: Props) {
  const update = (field: keyof PricingSettings, value: string) => {
    const num = parseFloat(value);
    onChange({ ...settings, [field]: isNaN(num) ? 0 : num });
  };

  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1">
        <label htmlFor="dealerDiscount" className="block text-xs font-medium text-slate-500">
          Återförsäljarrabatt (%)
        </label>
        <input
          id="dealerDiscount"
          type="number"
          step="0.1"
          value={settings.dealerDiscount || ''}
          onChange={(e) => update('dealerDiscount', e.target.value)}
          placeholder="0"
          disabled={disabled}
          className="block w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="priceAdjustment" className="block text-xs font-medium text-slate-500">
          Prisjustering (%)
        </label>
        <input
          id="priceAdjustment"
          type="number"
          step="0.1"
          value={settings.priceAdjustment || ''}
          onChange={(e) => update('priceAdjustment', e.target.value)}
          placeholder="0"
          disabled={disabled}
          className="block w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="exchangeRate" className="block text-xs font-medium text-slate-500">
          Växelkurs till SEK
        </label>
        <input
          id="exchangeRate"
          type="number"
          step="0.01"
          min="0"
          value={settings.exchangeRate || ''}
          onChange={(e) => update('exchangeRate', e.target.value)}
          placeholder="1"
          disabled={disabled}
          className="block w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
        />
      </div>
      {hasSpecialPrices && (
        <div className="space-y-1">
          <label htmlFor="specialPriceDiscount" className="block text-xs font-medium text-rose-600">
            Avtalsrabatt (%)
          </label>
          <input
            id="specialPriceDiscount"
            type="number"
            step="0.1"
            value={settings.specialPriceDiscount || ''}
            onChange={(e) => update('specialPriceDiscount', e.target.value)}
            placeholder="0"
            disabled={disabled}
            className="block w-36 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:bg-slate-100"
          />
        </div>
      )}
    </div>
  );
}
