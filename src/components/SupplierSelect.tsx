import { SUPPLIER_PROFILES } from '../config/suppliers';

interface Props {
  value: string;
  customName: string;
  onChange: (supplierId: string) => void;
  onCustomNameChange: (name: string) => void;
  disabled: boolean;
}

export function SupplierSelect({ value, customName, onChange, onCustomNameChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      <label htmlFor="supplier" className="block text-sm font-medium text-slate-700">
        Leverantör
      </label>
      <select
        id="supplier"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="block w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
      >
        <option value="">— Välj leverantör —</option>
        {SUPPLIER_PROFILES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {value === 'generic' && (
        <input
          type="text"
          value={customName}
          onChange={(e) => onCustomNameChange(e.target.value)}
          placeholder="Ange leverantörens namn..."
          disabled={disabled}
          className="block w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
        />
      )}
    </div>
  );
}
