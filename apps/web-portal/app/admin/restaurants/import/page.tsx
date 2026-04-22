'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, FileText, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { ImportSummaryCard } from '@/components/admin/ImportSummaryCard';
import { ImportResultsTable } from '@/components/admin/ImportResultsTable';
import type { AreaSelection } from '@/components/admin/ImportAreaSelector';
import type { ImportSummary } from '@/lib/import-types';

// Dynamic import to avoid Leaflet SSR crash
const ImportAreaSelector = dynamic(() => import('@/components/admin/ImportAreaSelector'), {
  ssr: false,
  loading: () => (
    <div className="h-80 rounded-lg border-2 flex items-center justify-center text-muted-foreground text-sm">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Loading map...
    </div>
  ),
});

export default function ImportPage() {
  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Google Places tab state
  const [selectedArea, setSelectedArea] = useState<AreaSelection | null>(null);
  const [maxPages, setMaxPages] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [apiWarnings, setApiWarnings] = useState<string[]>([]);
  const [monthlyApiCalls, setMonthlyApiCalls] = useState<number | null>(null);

  // CSV tab state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isCsvImporting, setIsCsvImporting] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<ImportSummary | null>(null);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authHeader()
      .then(headers => fetch('/api/admin/import/google', { headers }))
      .then(r => (r.ok ? r.json() : null))
      .then((data: { calls: number } | null) => {
        if (data && typeof data.calls === 'number') {
          setMonthlyApiCalls(data.calls);
        }
      })
      .catch(() => null);
  }, []);

  const handleImport = async () => {
    if (!selectedArea) return;

    setIsImporting(true);
    setImportResult(null);
    setApiWarnings([]);

    try {
      const response = await fetch('/api/admin/import/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          lat: selectedArea.lat,
          lng: selectedArea.lng,
          radius: selectedArea.radius,
          maxPages,
          textQuery: selectedArea.textQuery,
        }),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${response.status}`);
      }

      const data = (await response.json()) as ImportSummary & { warnings?: string[] };
      const { warnings: resWarnings, ...summary } = data;

      setImportResult(summary);
      if (resWarnings?.length) {
        setApiWarnings(resWarnings);
      }

      toast.success(
        `Import complete — ${summary.inserted} inserted, ${summary.skipped} skipped, ${summary.flagged} flagged`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportMore = () => {
    setImportResult(null);
    setApiWarnings([]);
  };

  // ── CSV handlers ────────────────────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a .csv file');
      return;
    }
    setCsvFile(file);
    setCsvParseError(null);
    setCsvImportResult(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;

    setIsCsvImporting(true);
    setCsvParseError(null);
    setCsvImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch('/api/admin/import/csv', {
        method: 'POST',
        headers: { ...(await authHeader()) },
        body: formData,
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as {
          error?: string;
          details?: string[];
        };
        const detail = errData.details?.join('; ') ?? errData.error ?? `HTTP ${response.status}`;
        setCsvParseError(detail);
        throw new Error(detail);
      }

      const data = (await response.json()) as ImportSummary;
      setCsvImportResult(data);

      toast.success(
        `CSV import complete — ${data.inserted} inserted, ${data.skipped} skipped, ${data.flagged} flagged`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CSV import failed';
      if (!csvParseError) toast.error(msg);
    } finally {
      setIsCsvImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const header =
      'name,address,latitude,longitude,phone,website,restaurant_type,cuisine_types,country_code,city,state,postal_code,mon_hours,tue_hours,wed_hours,thu_hours,fri_hours,sat_hours,sun_hours';
    const example =
      'Taquería El Paisa,Av Insurgentes Sur 1234 CDMX,19.3910,-99.1670,+525512345678,https://example.com,restaurant,Mexican,MX,Mexico City,CDMX,06600,08:00-22:00,08:00-22:00,08:00-22:00,08:00-22:00,08:00-23:00,09:00-23:00,09:00-20:00';
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'restaurant-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Restaurants"
        description="Bulk-import restaurant data from Google Places or a CSV file."
        backHref="/admin/restaurants"
      />

      <Tabs defaultValue="google">
        <TabsList>
          <TabsTrigger value="google">Google Places</TabsTrigger>
          <TabsTrigger value="csv">CSV Upload</TabsTrigger>
        </TabsList>

        {/* ── Google Places tab ─────────────────────────────────────────── */}
        <TabsContent value="google" className="space-y-6 pt-4">
          {/* Area selector */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h2 className="text-base font-semibold">Select import area</h2>
            <ImportAreaSelector onAreaSelect={setSelectedArea} />
          </div>

          {/* Import controls */}
          <div className="bg-card border rounded-lg p-5">
            {monthlyApiCalls !== null && (
              <p className="text-xs text-muted-foreground mb-3">
                {monthlyApiCalls} call{monthlyApiCalls !== 1 ? 's' : ''} this month
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Max pages */}
              <div className="flex items-center gap-2">
                <label htmlFor="max-pages" className="text-sm font-medium whitespace-nowrap">
                  Pages to fetch
                </label>
                <select
                  id="max-pages"
                  value={maxPages}
                  onChange={e => setMaxPages(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>
                      {n} page{n !== 1 ? 's' : ''} (~{n * 20} restaurants)
                    </option>
                  ))}
                </select>
              </div>

              {/* Import button */}
              <Button
                onClick={handleImport}
                disabled={!selectedArea || isImporting}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import Restaurants
                  </>
                )}
              </Button>

              {importResult && (
                <Button variant="outline" onClick={handleImportMore}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Import More
                </Button>
              )}
            </div>

            {/* Area/selection hint */}
            {!selectedArea && (
              <p className="mt-3 text-sm text-muted-foreground">
                Select an area on the map above to enable import.
              </p>
            )}
          </div>

          {/* API warnings */}
          {apiWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1">
              {apiWarnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-800">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          {/* Results */}
          {importResult && (
            <div className="space-y-4">
              <ImportSummaryCard summary={importResult} />

              {importResult.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-destructive mb-2">
                    Validation errors ({importResult.errors.length})
                  </h3>
                  <ul className="space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-destructive">
                        Row {e.index + 1}
                        {e.field ? ` (${e.field})` : ''}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importResult.restaurants.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Restaurant details ({importResult.restaurants.length} entries)
                  </h3>
                  <ImportResultsTable restaurants={importResult.restaurants} />
                </div>
              )}
            </div>
          )}

          {/* Empty state before first import */}
          {!importResult && !isImporting && (
            <div className="text-center py-10 text-muted-foreground">
              <Download className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                Select an area and click &ldquo;Import Restaurants&rdquo; to get started.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── CSV Upload tab ─────────────────────────────────────────────── */}
        <TabsContent value="csv" className="space-y-6 pt-4">
          {/* Template download */}
          <div className="bg-card border rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Upload CSV File</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Upload a CSV file with restaurant data. Required columns: name, latitude,
                  longitude.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload CSV file"
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-brand-primary/50 bg-brand-primary/5'
                  : csvFile
                    ? 'border-success/50 bg-success/10'
                    : 'border-input hover:border-input'
              }`}
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                  e.target.value = '';
                }}
              />

              {csvFile ? (
                <div className="space-y-2">
                  <FileText className="h-8 w-8 mx-auto text-success" />
                  <p className="text-sm font-medium text-success">{csvFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(csvFile.size / 1024).toFixed(1)} KB — click to choose a different file
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Drag &amp; drop a CSV file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">Only .csv files are accepted</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleCsvImport}
                disabled={!csvFile || isCsvImporting}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white"
              >
                {isCsvImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload &amp; Import
                  </>
                )}
              </Button>

              {csvFile && !isCsvImporting && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCsvFile(null);
                    setCsvParseError(null);
                    setCsvImportResult(null);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Parse error display */}
            {csvParseError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-medium text-destructive mb-1">CSV parse error</p>
                <p className="text-xs text-destructive">{csvParseError}</p>
              </div>
            )}
          </div>

          {/* CSV Results */}
          {csvImportResult && (
            <div className="space-y-4">
              <ImportSummaryCard summary={csvImportResult} />

              {csvImportResult.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-destructive mb-2">
                    Errors ({csvImportResult.errors.length})
                  </h3>
                  <ul className="space-y-1">
                    {csvImportResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-destructive">
                        Row {e.index + 1}
                        {e.field ? ` (${e.field})` : ''}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {csvImportResult.restaurants.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Restaurant details ({csvImportResult.restaurants.length} entries)
                  </h3>
                  <ImportResultsTable restaurants={csvImportResult.restaurants} />
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!csvImportResult && !isCsvImporting && (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                Upload a CSV file and click &ldquo;Upload &amp; Import&rdquo; to get started.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
