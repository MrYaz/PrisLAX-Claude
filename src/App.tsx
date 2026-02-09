import { useState, useEffect, useCallback } from 'react';
import type { PriceRow, PricingSettings, ProgressInfo } from './types';
import { loadBaseMappings } from './logic/articleMapping';
import { processFile } from './services/fileRouter';
import { postProcess } from './logic/postProcess';
import { exportToExcel } from './utils/excelExport';
import { FileUpload } from './components/FileUpload';
import { MappingUpload } from './components/MappingUpload';
import { PriceSettings } from './components/PriceSettings';
import { ProgressBar } from './components/ProgressBar';
import { ResultTable } from './components/ResultTable';
import './App.css';

export default function App() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [userMappingCount, setUserMappingCount] = useState(0);
  const [baseMappingLoaded, setBaseMappingLoaded] = useState(false);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    dealerDiscount: 0,
    priceAdjustment: 0,
    exchangeRate: 1,
  });

  // Load base mappings on startup
  useEffect(() => {
    loadBaseMappings().then(() => setBaseMappingLoaded(true));
  }, []);

  const handleFileSelected = useCallback(
    async (file: File) => {
      setProcessing(true);
      setError(null);
      setRows([]);
      setFileName(file.name);
      setProgress({ message: 'Förbereder...', current: 0, total: 1 });

      try {
        // Step 1: Extract via AI
        const rawRows = await processFile(file, setProgress);

        if (rawRows.length === 0) {
          setError('Inga produktrader hittades i filen. Kontrollera att filen innehåller en prislista.');
          setProcessing(false);
          setProgress(null);
          return;
        }

        setProgress({
          message: `Efterbehandlar ${rawRows.length} rader...`,
          current: 0,
          total: 1,
        });

        // Step 2: Post-process (merge accessories, map articles, calculate prices)
        const finalRows = postProcess(rawRows, pricingSettings);

        setRows(finalRows);
        setProgress({
          message: `Konvertering klar — ${finalRows.length} rader`,
          current: 1,
          total: 1,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Okänt fel';
        setError(msg);
        setProgress(null);
      } finally {
        setProcessing(false);
      }
    },
    [pricingSettings]
  );

  const handleExport = useCallback(() => {
    if (rows.length === 0) return;
    const baseName = fileName.replace(/\.[^.]+$/, '');
    exportToExcel(rows, `${baseName}_prislista.xlsx`);
  }, [rows, fileName]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PrisLAX</h1>
        <p className="subtitle">Konvertera leverantörers prislistor till ett standardiserat format</p>
      </header>

      <main className="app-main">
        <section className="controls-section">
          <div className="controls-row">
            <FileUpload onFileSelected={handleFileSelected} disabled={processing} />
            <MappingUpload
              hasMappings={userMappingCount > 0}
              onMappingsChanged={setUserMappingCount}
            />
          </div>

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

        {(processing || progress) && <ProgressBar progress={progress} />}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {rows.length > 0 && !processing && (
          <section className="results-section">
            <div className="results-header">
              <span className="done-message">Konvertering klar</span>
              <button className="export-btn" onClick={handleExport} type="button">
                Hämta Excel
              </button>
            </div>
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
