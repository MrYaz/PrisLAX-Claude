import type { PriceRow } from '../types';
import { OUTPUT_COLUMNS } from '../types';

interface Props {
  rows: PriceRow[];
}

/** Map column name to PriceRow field */
function getCellValue(row: PriceRow, col: string): string {
  const map: Record<string, string> = {
    'Ert artikelnr': row.ertArtikelnr,
    'Vårt artikelnr': row.vartArtikelnr,
    'Benämning': row.benamning,
    'Varugrupp': row.varugrupp,
    'Kort beskrivning': row.kortBeskrivning,
    'Ord. pris': row.ordPris,
    'Rabatt %': row.rabattProcent,
    'Nettopris (SEK)': row.nettoprisSEK,
    'Vikt (kg)': row.vikt,
    'Volym (m3)': row.volym,
    'Höjd (mm)': row.hojd,
    'Bredd (mm)': row.bredd,
    'Djup (mm)': row.djup,
    'Diameter (mm)': row.diameter,
    'Helpall': row.helpall,
    'Halvpall': row.halvpall,
    'Pallkostnad': row.pallkostnad,
    'RAL-färg': row.ralFarg,
    'Fast frakt (kr)': row.fastFrakt,
    'Leveranstid (dagar)': row.leveranstid,
    'Ursprungsland': row.ursprungsland,
    'Manual-länk': row.manualLank,
    'Produktlänk': row.produktLank,
  };
  return map[col] ?? '';
}

/** Columns that should be right-aligned (numeric) */
const NUMERIC_COLS = new Set([
  'Ord. pris', 'Rabatt %', 'Nettopris (SEK)', 'Vikt (kg)', 'Volym (m3)',
  'Höjd (mm)', 'Bredd (mm)', 'Djup (mm)', 'Diameter (mm)',
  'Helpall', 'Halvpall', 'Pallkostnad', 'Fast frakt (kr)', 'Leveranstid (dagar)',
]);

/** Pastel header colors matching the Excel export groups */
const HEADER_COLORS: Record<string, string> = {
  'Ert artikelnr': 'bg-blue-100',
  'Vårt artikelnr': 'bg-blue-100',
  'Benämning': 'bg-green-100',
  'Varugrupp': 'bg-green-100',
  'Kort beskrivning': 'bg-green-100',
  'Ord. pris': 'bg-orange-100',
  'Rabatt %': 'bg-orange-100',
  'Nettopris (SEK)': 'bg-orange-100',
  'Vikt (kg)': 'bg-purple-100',
  'Volym (m3)': 'bg-purple-100',
  'Höjd (mm)': 'bg-purple-100',
  'Bredd (mm)': 'bg-purple-100',
  'Djup (mm)': 'bg-purple-100',
  'Diameter (mm)': 'bg-purple-100',
  'Helpall': 'bg-yellow-100',
  'Halvpall': 'bg-yellow-100',
  'Pallkostnad': 'bg-yellow-100',
  'RAL-färg': 'bg-yellow-100',
  'Fast frakt (kr)': 'bg-yellow-100',
  'Leveranstid (dagar)': 'bg-yellow-100',
  'Ursprungsland': 'bg-yellow-100',
  'Manual-länk': 'bg-pink-100',
  'Produktlänk': 'bg-pink-100',
};

export function ResultTable({ rows }: Props) {
  if (rows.length === 0) return null;

  const specialCount = rows.filter((r) => r.hasSpecialPrice).length;

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">
        {rows.length} artikel{rows.length !== 1 ? 'rader' : 'rad'} extraherade
        {specialCount > 0 && (
          <span className="ml-2 text-rose-600">
            ({specialCount} med avtalspris)
          </span>
        )}
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {OUTPUT_COLUMNS.map((col) => (
                <th
                  key={col}
                  className={`px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap border-b border-slate-300 ${HEADER_COLORS[col] || 'bg-slate-100'} ${NUMERIC_COLS.has(col) ? 'text-right' : ''}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr
                key={i}
                className={
                  row.varugrupp === 'Tillbehör'
                    ? 'bg-amber-50/50 hover:bg-amber-100/50'
                    : 'hover:bg-slate-50'
                }
              >
                {OUTPUT_COLUMNS.map((col) => {
                  const isSpecialNettopris = row.hasSpecialPrice && col === 'Nettopris (SEK)';
                  return (
                    <td
                      key={col}
                      className={`px-3 py-2 ${col === 'Benämning' || col === 'Kort beskrivning' ? '' : 'whitespace-nowrap'} ${NUMERIC_COLS.has(col) ? 'text-right tabular-nums' : ''} ${isSpecialNettopris ? 'bg-rose-100 font-semibold text-rose-800' : ''}`}
                    >
                      {getCellValue(row, col)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
