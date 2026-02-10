import { useRef } from 'react';
import { parseMappingFile } from '../utils/mappingUpload';
import { setUserMappings, clearUserMappings } from '../logic/articleMapping';

interface Props {
  hasMappings: boolean;
  onMappingsChanged: (count: number) => void;
}

export function MappingUpload({ hasMappings, onMappingsChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const mappings = await parseMappingFile(file);
      setUserMappings(mappings);
      onMappingsChanged(mappings.length);
    } catch (err) {
      alert(`Kunde inte läsa mappningsfil: ${err}`);
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClear = () => {
    clearUserMappings();
    onMappingsChanged(0);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.txt"
        onChange={handleChange}
        id="mapping-file-input"
        className="hidden"
      />
      <label
        htmlFor="mapping-file-input"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors cursor-pointer hover:bg-slate-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        Artikelmappning
      </label>
      {hasMappings && (
        <button
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          onClick={handleClear}
          type="button"
        >
          Rensa
        </button>
      )}
    </div>
  );
}
