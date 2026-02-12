import { useState, useEffect, useCallback, useRef } from 'react';
import type { PriceRow, PricingSettings, ProgressInfo, RawExtractedRow, SpecialPriceData } from './types';
import { loadBaseMappings } from './logic/articleMapping';
import { processFile } from './services/fileRouter';
import { postProcess } from './logic/postProcess';
import { exportToExcel } from './utils/excelExport';
import { buildExportFilename } from './utils/dateParser';
import { getSupplierProfile } from './config/suppliers';
import { FileUpload } from './components/FileUpload';
import { MappingUpload } from './components/MappingUpload';
import { SpecialPriceUpload } from './components/SpecialPriceUpload';
import { SupplierSelect } from './components/SupplierSelect';
import { PriceSettings } from './components/PriceSettings';
import { ProgressBar } from './components/ProgressBar';
import { StatusMonitor } from './components/StatusMonitor';
import { ResultTable } from './components/ResultTable';

function hasApiKey(): boolean {
  return Boolean(import.meta.env.VITE_API_KEY);
}

export default function App() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [supplierId, setSupplierId] = useState<string>('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [userMappingCount, setUserMappingCount] = useState(0);
  const [baseMappingLoaded, setBaseMappingLoaded] = useState(false);
  const [wasAborted, setWasAborted] = useState(false);
  const [specialPriceData, setSpecialPriceData] = useState<SpecialPriceData | null>(null);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    dealerDiscount: 0,
    priceAdjustment: 0,
    exchangeRate: 1,
    specialPriceDiscount: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadBaseMappings().then(() => setBaseMappingLoaded(true));
  }, []);

  const handleSupplierChange = useCallback((newId: string) => {
    setSupplierId(newId);
    const profile = getSupplierProfile(newId);
    setPricingSettings((prev) => ({
      ...prev,
      dealerDiscount: profile.defaultDiscount,
    }));
  }, []);

  const effectiveSupplierName =
    supplierId === 'generic'
      ? customSupplierName
      : supplierId
        ? getSupplierProfile(supplierId).name
        : '';

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
    setRows([]);
    setProgress(null);
    setWasAborted(false);
  }, []);

  const handleSpecialPriceDataChanged = useCallback((data: SpecialPriceData | null) => {
    setSpecialPriceData(data);
    if (!data) {
      setPricingSettings((prev) => ({ ...prev, specialPriceDiscount: 0 }));
    }
  }, []);

  const handleGeneralDiscountDetected = useCallback((discount: number) => {
    // Auto-fill the special price discount with the general discount from the file
    setPricingSettings((prev) => ({ ...prev, specialPriceDiscount: discount }));
  }, []);

  const handleConvert = useCallback(async () => {
    if (!selectedFile) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setProcessing(true);
    setError(null);
    setRows([]);
    setWasAborted(false);
    setProgress({ message: 'Förbereder...', current: 0, total: 1 });

    let rawRows: RawExtractedRow[] = [];

    try {
      rawRows = await processFile(selectedFile, supplierId, setProgress, controller.signal);
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

    setProgress({
      message: `Efterbehandlar ${rawRows.length} rader...`,
      current: 0,
      total: 1,
    });

    const finalRows = postProcess(rawRows, pricingSettings, effectiveSupplierName, specialPriceData);

    setRows(finalRows);
    setWasAborted(aborted);

    const specialCount = finalRows.filter((r) => r.hasSpecialPrice).length;
    const specialSuffix = specialCount > 0 ? ` (${specialCount} med avtalspris)` : '';

    setProgress({
      message: aborted
        ? `Delvis extrahering — ${finalRows.length} rader (stoppad)${specialSuffix}`
        : `Konvertering klar — ${finalRows.length} rader${specialSuffix}`,
      current: 1,
      total: 1,
    });
    setProcessing(false);
  }, [selectedFile, pricingSettings, supplierId, effectiveSupplierName, specialPriceData]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleExport = useCallback(() => {
    if (rows.length === 0 || !selectedFile) return;
    const exportName = buildExportFilename(effectiveSupplierName, selectedFile.name);
    exportToExcel(rows, exportName);
  }, [rows, selectedFile, effectiveSupplierName]);

  const apiKeyMissing = !hasApiKey();
  const canSelectFile = !processing && !apiKeyMissing && Boolean(supplierId);
  const canConvert =
    !processing &&
    Boolean(selectedFile) &&
    Boolean(supplierId) &&
    (supplierId !== 'generic' || Boolean(customSupplierName.trim()));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-800 tracking-wide">PrisLAX</h1>
          <p className="text-sm text-slate-500 mt-1">
            Konvertera leverantörers prislistor till ett standardiserat format
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {apiKeyMissing && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            API-nyckel saknas. Sätt miljövariabeln{' '}
            <code className="bg-red-100 px-1 py-0.5 rounded text-xs font-mono">VITE_API_KEY</code>{' '}
            och bygg om appen.
          </div>
        )}

        {/* Controls card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
          <SupplierSelect
            value={supplierId}
            customName={customSupplierName}
            onChange={handleSupplierChange}
            onCustomNameChange={setCustomSupplierName}
            disabled={processing}
          />

          <div className="flex flex-wrap items-start gap-4">
            <FileUpload
              onFileSelected={handleFileSelected}
              disabled={!canSelectFile}
              selectedFileName={selectedFile?.name}
            />
            <MappingUpload
              hasMappings={userMappingCount > 0}
              onMappingsChanged={setUserMappingCount}
            />
            <SpecialPriceUpload
              data={specialPriceData}
              onDataChanged={handleSpecialPriceDataChanged}
              onGeneralDiscountDetected={handleGeneralDiscountDetected}
              disabled={processing}
            />
          </div>

          {!supplierId && !processing && (
            <p className="text-sm text-slate-400 italic">
              Välj leverantör innan du laddar upp en prislista.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {userMappingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {userMappingCount} artikelmappningar
              </span>
            )}
            {baseMappingLoaded && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                Basmappning laddad
              </span>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Prisjusteringar
            </h3>
            <PriceSettings
              settings={pricingSettings}
              onChange={setPricingSettings}
              disabled={processing}
              hasSpecialPrices={specialPriceData !== null}
            />
          </div>

          {/* Konvertera nu! button */}
          {selectedFile && !processing && rows.length === 0 && (
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleConvert}
                disabled={!canConvert}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Konvertera nu!
              </button>
              {supplierId === 'generic' && !customSupplierName.trim() && (
                <p className="text-xs text-amber-600 mt-2">
                  Ange leverantörens namn för att kunna konvertera.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Processing status */}
        {(processing || (progress && !rows.length && !error)) && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <ProgressBar progress={progress} />
            <StatusMonitor stats={progress?.stats} />
            {processing && (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
                Stoppa extrahering
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {rows.length > 0 && !processing && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span
                className={`text-lg font-semibold ${wasAborted ? 'text-amber-600' : 'text-emerald-600'}`}
              >
                {wasAborted
                  ? `Delvis extrahering — ${rows.length} rader`
                  : `Konvertering klar — ${rows.length} rader`}
              </span>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Hämta Excel
              </button>
            </div>

            {wasAborted && (
              <p className="text-sm text-amber-600 italic">
                Extraheringen stoppades. Resultatet nedan är partiellt. Granska det för att se
                vilka direktiv som behövs.
              </p>
            )}

            <ResultTable rows={rows} />
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-6 text-center">
        <p className="text-xs text-slate-400">AI läser dokument. Kod bestämmer struktur och regler.</p>
      </footer>
    </div>
  );
}
