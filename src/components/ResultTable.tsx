import type { PriceRow } from '../types';
import { OUTPUT_COLUMNS } from '../types';

interface Props {
  rows: PriceRow[];
}

export function ResultTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">
        {rows.length} artikel{rows.length !== 1 ? 'rader' : 'rad'} extraherade
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              {OUTPUT_COLUMNS.map((col) => (
                <th key={col} className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">
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
                    ? 'bg-amber-50 hover:bg-amber-100'
                    : 'hover:bg-slate-50'
                }
              >
                <td className="px-3 py-2 whitespace-nowrap">{row.ertArtikelnr}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.vartArtikelnr}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.varugrupp}</td>
                <td className="px-3 py-2">{row.benamning}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.vikt}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.volym}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.pallkostnad}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{row.originalpris}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{row.nettoprisSEK}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
