import type { ProgressInfo } from '../types';

interface Props {
  progress: ProgressInfo | null;
}

export function ProgressBar({ progress }: Props) {
  if (!progress) return null;

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-700">{progress.message}</span>
        <span className="text-xs font-medium text-slate-500">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
