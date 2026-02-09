import { SUPPLIER_PROFILES } from '../config/suppliers';

interface Props {
  value: string;
  onChange: (supplierId: string) => void;
  disabled: boolean;
}

export function SupplierSelect({ value, onChange, disabled }: Props) {
  return (
    <div className="supplier-select">
      <label htmlFor="supplier">Leverantör</label>
      <select
        id="supplier"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Välj leverantör —</option>
        {SUPPLIER_PROFILES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
