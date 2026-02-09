import type { PriceRow } from '../types';
import { OUTPUT_COLUMNS } from '../types';

interface Props {
  rows: PriceRow[];
}

export function ResultTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="result-table-container">
      <div className="result-summary">
        {rows.length} artikel{rows.length !== 1 ? 'rader' : 'rad'} extraherade
      </div>
      <div className="table-scroll">
        <table className="result-table">
          <thead>
            <tr>
              {OUTPUT_COLUMNS.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={row.varugrupp === 'Tillbehör' ? 'accessory-row' : ''}>
                <td>{row.ertArtikelnr}</td>
                <td>{row.vartArtikelnr}</td>
                <td>{row.varugrupp}</td>
                <td>{row.benamning}</td>
                <td>{row.vikt}</td>
                <td>{row.volym}</td>
                <td>{row.pallkostnad}</td>
                <td className="price-cell">{row.originalpris}</td>
                <td className="price-cell">{row.nettoprisSEK}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
