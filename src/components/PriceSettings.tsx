import type { PricingSettings } from '../types';

interface Props {
  settings: PricingSettings;
  onChange: (settings: PricingSettings) => void;
  disabled: boolean;
}

export function PriceSettings({ settings, onChange, disabled }: Props) {
  const update = (field: keyof PricingSettings, value: string) => {
    const num = parseFloat(value);
    onChange({ ...settings, [field]: isNaN(num) ? 0 : num });
  };

  return (
    <div className="price-settings">
      <div className="setting-row">
        <label htmlFor="dealerDiscount">Återförsäljarrabatt (%)</label>
        <input
          id="dealerDiscount"
          type="number"
          step="0.1"
          value={settings.dealerDiscount || ''}
          onChange={(e) => update('dealerDiscount', e.target.value)}
          placeholder="0"
          disabled={disabled}
        />
      </div>
      <div className="setting-row">
        <label htmlFor="priceAdjustment">Prisjustering (%)</label>
        <input
          id="priceAdjustment"
          type="number"
          step="0.1"
          value={settings.priceAdjustment || ''}
          onChange={(e) => update('priceAdjustment', e.target.value)}
          placeholder="0"
          disabled={disabled}
        />
      </div>
      <div className="setting-row">
        <label htmlFor="exchangeRate">Växelkurs till SEK</label>
        <input
          id="exchangeRate"
          type="number"
          step="0.01"
          min="0"
          value={settings.exchangeRate || ''}
          onChange={(e) => update('exchangeRate', e.target.value)}
          placeholder="1"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
