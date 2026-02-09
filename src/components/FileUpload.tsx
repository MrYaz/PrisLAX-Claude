import { useRef } from 'react';
import { detectFileType } from '../services/fileRouter';

interface Props {
  onFileSelected: (file: File) => void;
  disabled: boolean;
}

const ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.xlsb,.docx,.doc,.png,.jpg,.jpeg,.gif,.bmp,.webp,.tiff,.tif';

export function FileUpload({ onFileSelected, disabled }: Props) {
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
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        disabled={disabled}
        id="price-file-input"
        style={{ display: 'none' }}
      />
      <label
        htmlFor="price-file-input"
        className={`upload-btn ${disabled ? 'disabled' : ''}`}
      >
        Ladda upp prislista
      </label>
    </div>
  );
}
