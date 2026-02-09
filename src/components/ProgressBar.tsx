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
    <div className="progress-container">
      <div className="progress-message">{progress.message}</div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="progress-pct">{pct}%</div>
    </div>
  );
}
