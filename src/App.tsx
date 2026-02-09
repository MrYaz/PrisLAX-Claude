import { useState, useEffect, useCallback, useRef } from 'react';
import type { PriceRow, PricingSettings, ProgressInfo, RawExtractedRow } from './types';
import { loadBaseMappings } from './logic/articleMapping';
import { processFile } from './services/fileRouter';
import { postProcess } from './logic/postProcess';
import { exportToExcel } from './utils/excelExport';
import { getSupplierProfile } from './config/suppliers';
import { FileUpload } from './components/FileUpload';
import { MappingUpload } from './components/MappingUpload';
import { SupplierSelect } from './components/SupplierSelect';
import { PriceSettings } from './components/PriceSettings';
import { ProgressBar } from './components/ProgressBar';
import { ResultTable } from './components/ResultTable';
import './App.css';

function hasApiKey(): boolean {
  return Boolean(import.meta.env.VITE_API_KEY);
}

export default function App() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [userMappingCount, setUserMappingCount] = useState(0);
  const [baseMappingLoaded, setBaseMappingLoaded] = useState(false);
  const [wasAborted, setWasAborted] = useState(false);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    dealerDiscount: 0,
    priceAdjustment: 0,
    exchangeRate: 1,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadBaseMappings().then(() => setBaseMappingLoaded(true));
  }, []);

  const handleFileSelected = useCallback(
    async (file: File) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setProcessing(true);
      setError(null);
      setRows([]);
      setWasAborted(false);
      setFileName(file.name);
      setProgress({ message: 'Förbereder...', current: 0, total: 1 });

      let rawRows: RawExtractedRow[] = [];

      try {
        rawRows = await processFile(file, supplierId, setProgress, controller.signal);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Okänt fel';
        setError(msg);
        setProgress(null);
        setProcessing(false);
        abortControllerRef.current = null;
        return;
      }

      const aborted = controller.signal.aborted;
      abortControllerRef.current = null;

      if (rawRows.length === 0) {
        if (aborted) {
          setError('Extrahering stoppad innan några rader hittades.');
        } else {
          setError('Inga produktrader hittades i filen. Kontrollera att filen innehåller en prislista.');
        }
        setProcessing(false);
        setProgress(null);
        return;
      }

      const supplierName = supplierId ? getSupplierProfile(supplierId).name : '';

      setProgress({
        message: `Efterbehandlar ${rawRows.length} rader...`,
        current: 0,
        total: 1,
      });

      const finalRows = postProcess(rawRows, pricingSettings, supplierName);

      setRows(finalRows);
      setWasAborted(aborted);
      setProgress({
        message: aborted
          ? `Delvis extrahering — ${finalRows.length} rader (stoppad)`
          : `Konvertering klar — ${finalRows.length} rader`,
        current: 1,
        total: 1,
      });
      setProcessing(false);
    },
    [pricingSettings, supplierId]
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleExport = useCallback(() => {
    if (rows.length === 0) return;
    const baseName = fileName.replace(/\.[^.]+$/, '');
    exportToExcel(rows, `${baseName}_prislista.xlsx`);
  }, [rows, fileName]);

  const apiKeyMissing = !hasApiKey();
  const canUpload = !processing && !apiKeyMissing && Boolean(supplierId);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PrisLAX</h1>
        <p className="subtitle">Konvertera leverantörers prislistor till ett standardiserat format</p>
      </header>

      <main className="app-main">
        {apiKeyMissing && (
          <div className="error-message">
            API-nyckel saknas. Sätt miljövariabeln <code>VITE_API_KEY</code> och bygg om appen.
          </div>
        )}

        <section className="controls-section">
          <SupplierSelect
            value={supplierId}
            onChange={setSupplierId}
            disabled={processing}
          />

          <div className="controls-row">
            <FileUpload onFileSelected={handleFileSelected} disabled={!canUpload} />
            <MappingUpload
              hasMappings={userMappingCount > 0}
              onMappingsChanged={setUserMappingCount}
            />
          </div>

          {!supplierId && !processing && (
            <div className="hint-message">Välj leverantör innan du laddar upp en prislista.</div>
          )}

          {userMappingCount > 0 && (
            <div className="mapping-info">
              {userMappingCount} artikelmappningar laddade
            </div>
          )}

          {baseMappingLoaded && (
            <div className="mapping-info base">
              Basmappning laddad
            </div>
          )}

          <PriceSettings
            settings={pricingSettings}
            onChange={setPricingSettings}
            disabled={processing}
          />
        </section>

        {(processing || progress) && (
          <div className="progress-section">
            <ProgressBar progress={progress} />
            {processing && (
              <button className="stop-btn" onClick={handleStop} type="button">
                Stoppa extrahering
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {rows.length > 0 && !processing && (
          <section className="results-section">
            <div className="results-header">
              <span className={wasAborted ? 'partial-message' : 'done-message'}>
                {wasAborted
                  ? `Delvis extrahering — ${rows.length} rader`
                  : 'Konvertering klar'}
              </span>
              <button className="export-btn" onClick={handleExport} type="button">
                Hämta Excel
              </button>
            </div>
            {wasAborted && (
              <div className="hint-message">
                Extraheringen stoppades. Resultatet nedan är partiellt.
                Granska det för att se vilka direktiv som behövs för att förbättra extraheringen.
              </div>
            )}
            <ResultTable rows={rows} />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>AI läser dokument. Kod bestämmer struktur och regler.</p>
      </footer>
    </div>
  );
}
