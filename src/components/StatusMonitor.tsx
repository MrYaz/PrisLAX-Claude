import type { ExtractionStats } from '../types';

interface Props {
  stats: ExtractionStats | undefined;
}

export function StatusMonitor({ stats }: Props) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
      <div className="bg-blue-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-blue-700">{stats.articlesFound}</div>
        <div className="text-xs text-blue-600">Artiklar hittade</div>
      </div>
      <div className="bg-amber-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-amber-700">{stats.accessoriesFound}</div>
        <div className="text-xs text-amber-600">Tillbehör</div>
      </div>
      <div className="col-span-2 bg-slate-50 rounded-lg p-3">
        <div className="text-xs text-slate-500 mb-1">Varugrupper</div>
        <div className="flex flex-wrap gap-1">
          {stats.varugrupper.length > 0 ? (
            stats.varugrupper.map((vg) => (
              <span
                key={vg}
                className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full"
              >
                {vg}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      </div>
      {stats.pageDetails.length > 0 && (
        <div className="col-span-2 sm:col-span-4">
          <div className="text-xs text-slate-500 mb-1">Per sida/flik</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {stats.pageDetails.map((pd, i) => (
              <div
                key={i}
                className="flex justify-between text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded"
              >
                <span>{pd.label}</span>
                <span>
                  {pd.articles} artiklar
                  {pd.accessories > 0 ? `, ${pd.accessories} tillbehör` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
