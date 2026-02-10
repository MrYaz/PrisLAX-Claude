import { useRef } from 'react';
import { detectFileType } from '../services/fileRouter';

interface Props {
  onFileSelected: (file: File) => void;
  disabled: boolean;
  selectedFileName?: string;
}

const ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.xlsb,.docx,.doc,.png,.jpg,.jpeg,.gif,.bmp,.webp,.tiff,.tif';

export function FileUpload({ onFileSelected, disabled, selectedFileName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = detectFileType(file);
    if (!type) {
      alert(`Filtypen "${file.name}" stöds inte.\nAnvänd PDF, Excel, Word eller bild.`);
      return;
    }

    onFileSelected(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        disabled={disabled}
        id="price-file-input"
        className="hidden"
      />
      <label
        htmlFor="price-file-input"
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
          disabled
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-slate-700 text-white hover:bg-slate-800'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Välj prislista
      </label>
      {selectedFileName && (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {selectedFileName}
        </div>
      )}
    </div>
  );
}
