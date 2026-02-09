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
    <div className="mapping-upload">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.txt"
        onChange={handleChange}
        id="mapping-file-input"
        style={{ display: 'none' }}
      />
      <label htmlFor="mapping-file-input" className="upload-btn secondary">
        Ladda upp artikelmappning
      </label>
      {hasMappings && (
        <button className="clear-btn" onClick={handleClear} type="button">
          Rensa mappning
        </button>
      )}
    </div>
  );
}
