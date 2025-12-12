
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient, OdooModel, OdooFieldMeta, ImportDryRunResult, ImportRunResult, ImportMapping, FieldMapping, ParsedWorkbook } from '../api/apiClient';

import { Upload, ArrowRight, CheckCircle, AlertCircle, Play, Loader, RotateCw, FileSpreadsheet, ArrowLeft, Database, Key, Search, Settings } from 'lucide-react';
import { BasicMappingSection } from '../modules/import/BasicMappingSection';
import { ProMappingSection } from '../modules/import/ProMappingSection';


const ImportWizardPage = () => {
    const { macroId, entityId } = useParams();
    const [model, setModel] = useState<OdooModel | null>(null);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1: Upload Data
    const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
    const [activeSheetName, setActiveSheetName] = useState<string | null>(null);

    type SheetSelectionState = {
        [sheetName: string]: {
            selectedRowIndexes: number[];
        };
    };

    const [sheetSelections, setSheetSelections] = useState<SheetSelectionState>({});

    // Computed single-structure for compatibility with existing flow (Step 2/3/4)
    // We update this when proceeding to step 2 based on selection
    const [legacyUploadedFile, setLegacyUploadedFile] = useState<{ columns: string[], rows: any[] } | null>(null);

    // Pagination State
    const [pageSize, setPageSize] = useState<number>(50);
    const [page, setPage] = useState<number>(1);

    // Reset page when switching sheets
    useEffect(() => {
        setPage(1);
    }, [activeSheetName]);



    // Step 2: Mapping
    const [fields, setFields] = useState<OdooFieldMeta[]>([]);
    const [importMode, setImportMode] = useState<'basic' | 'pro'>('basic');
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [proMapping, setProMapping] = useState<ImportMapping>({});
    const [options, setOptions] = useState({ keyField: '', createIfNotExists: true });


    // Step 2 UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [showRequiredOnly, setShowRequiredOnly] = useState(false);

    // Step 3: Dry Run
    const [dryRunResult, setDryRunResult] = useState<ImportDryRunResult | null>(null);

    // Step 4: Run
    const [runResult, setRunResult] = useState<ImportRunResult | null>(null);


    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Fetch config for import mode
                const config = await apiClient.getOdooConfig();
                if (config && config.importMode) setImportMode(config.importMode);

                // Fetch from macros config to find the entity
                const macros = await apiClient.getMacros();
                const macro = macros.find(m => m.id === macroId);
                const entity = macro?.entities.find(e => e.id === entityId);


                if (entity) {
                    // We construct a compatible OdooModel object for local state
                    setModel({ id: entity.id, label: entity.label, model: entity.model });

                    // Fetch fields immediately
                    const fieldsData = await apiClient.getFields(entity.model);
                    setFields(fieldsData);
                } else {
                    setError("Entity not found in configuration.");
                }
            } catch (err: any) {
                setError(err.message);
            }
        };
        if (macroId && entityId) loadInitialData();
    }, [macroId, entityId]);


    // Step 1 Handler
    const handleFileSelected = async (file: File) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiClient.uploadExcel(file);
            setWorkbook(data);
            const initialSheet = data.defaultSheet || (data.sheets.length > 0 ? data.sheets[0].name : null);
            setActiveSheetName(initialSheet);

            // Initialize selections map
            const selections: SheetSelectionState = {};
            data.sheets.forEach(sheet => {
                selections[sheet.name] = { selectedRowIndexes: [] };
            });
            setSheetSelections(selections);

        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        handleFileSelected(e.target.files[0]);
    };


    // Drag & Drop Handlers
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Check if leaving the drop zone entirely
        if ((e.target as HTMLElement).contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelected(file);
    };

    // Step 2 Handler
    const handleMappingChange = (field: string, column: string) => {
        setMapping(prev => {
            if (column === '') {
                const copy = { ...prev };
                delete copy[field];
                return copy;
            }
            return { ...prev, [field]: column };
        });
    };

    const handleProMappingChange = (field: string, val: FieldMapping) => {
        setProMapping(prev => ({ ...prev, [field]: val }));
    };


    // Step 3 Handler
    const handleDryRun = async () => {
        if (!model || !legacyUploadedFile) return;
        setLoading(true);
        setError(null);
        try {
            const payload = {
                model: model.model,
                mapping: importMode === 'basic' ? mapping : proMapping,
                rows: legacyUploadedFile.rows,
                options
            };
            const result = await apiClient.dryRunImport(payload);
            setDryRunResult(result);
            setStep(3);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Step 4 Handler
    const handleRunImport = async () => {
        if (!model || !legacyUploadedFile) return;
        setLoading(true);
        try {
            const payload = {
                model: model.model,
                mapping: importMode === 'basic' ? mapping : proMapping,
                rows: legacyUploadedFile.rows,
                options
            };
            const result = await apiClient.runImport(payload);
            setRunResult(result);
            setStep(4);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };



    // Render Steps
    const renderStep1 = () => {
        const activeSheet = workbook ? workbook.sheets.find(s => s.name === activeSheetName) : null;

        // Pagination logic
        const totalRows = activeSheet ? activeSheet.rowCount : 0;
        const totalPages = totalRows > 0 ? Math.ceil(totalRows / pageSize) : 1;
        const currentPage = Math.min(page, totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalRows);
        const visibleRows = activeSheet ? activeSheet.rows.slice(startIndex, endIndex) : [];

        // selection logic
        const toggleAll = () => {
            if (!activeSheetName) return;
            const current = sheetSelections[activeSheetName].selectedRowIndexes;
            const total = activeSheet?.rowCount || 0;
            // If all selected, clear. Else select all.
            // Note: we can't select all easily if we only have previewRows + raw rows loaded. 
            // The parser returns ALL rows in .rows, so we can use that length.
            if (current.length === total) {
                setSheetSelections({ ...sheetSelections, [activeSheetName]: { selectedRowIndexes: [] } });
            } else {
                setSheetSelections({
                    ...sheetSelections,
                    [activeSheetName]: { selectedRowIndexes: activeSheet?.rows.map((_, i) => i) || [] }
                });
            }
        };

        const toggleRow = (index: number) => {
            if (!activeSheetName) return;
            const current = sheetSelections[activeSheetName].selectedRowIndexes;
            let next = [...current];
            if (next.includes(index)) {
                next = next.filter(i => i !== index);
            } else {
                next.push(index);
            }
            setSheetSelections({ ...sheetSelections, [activeSheetName]: { selectedRowIndexes: next } });
        };

        const isRowSelected = (index: number) => {
            if (!activeSheetName) return false;
            return sheetSelections[activeSheetName].selectedRowIndexes.includes(index);
        };

        const totalSelected = Object.values(sheetSelections).reduce((acc, s) => acc + s.selectedRowIndexes.length, 0);

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {!workbook ? (
                    <div
                        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer flex flex-col items-center justify-center ${isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 hover:bg-slate-50"}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className={`mx-auto mb-4 ${isDragging ? "text-blue-500" : "text-slate-400"}`} size={48} />
                        <h3 className={`text-lg font-semibold ${isDragging ? "text-blue-700" : "text-slate-700"}`}>
                            {isDragging ? "Drop Excel File Here" : "Upload Excel File (.xlsx)"}
                        </h3>
                        <p className="text-slate-500 mb-6 text-sm">Drag and drop or click to select</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                        {/* Sheet Tabs */}
                        <div className="flex overflow-x-auto bg-slate-100 border-b border-slate-200">

                            {workbook.sheets.map(sheet => (
                                <button
                                    key={sheet.name}
                                    onClick={() => setActiveSheetName(sheet.name)}
                                    className={`px-4 py-3 text-sm font-medium border-r border-slate-200 whitespace-nowrap transition-colors flex items-center gap-2
                                        ${activeSheetName === sheet.name ? 'bg-white text-teal-700 border-b-2 border-b-teal-500' : 'text-slate-600 hover:bg-slate-50'}
                                    `}
                                >
                                    <FileSpreadsheet size={16} />
                                    {sheet.name}
                                    <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                                        {sheet.rowCount}
                                    </span>
                                    {sheetSelections[sheet.name]?.selectedRowIndexes.length > 0 && (
                                        <span className="bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                                            {sheetSelections[sheet.name].selectedRowIndexes.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div className="p-2 border-b border-slate-100 flex flex-wrap gap-2 justify-between items-center bg-white">
                            <div className="flex gap-2">
                                <button onClick={toggleAll} className="text-xs font-medium px-3 py-1.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors">
                                    {activeSheet && sheetSelections[activeSheetName!]?.selectedRowIndexes.length === activeSheet.rowCount ? 'Deselect All' : 'Select All'} in Sheet
                                </button>
                                <button
                                    onClick={() => activeSheetName && setSheetSelections({ ...sheetSelections, [activeSheetName]: { selectedRowIndexes: [] } })}
                                    className="text-xs font-medium px-3 py-1.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                                >
                                    Clear Selection
                                </button>
                            </div>

                            {/* Pagination Controls */}
                            {activeSheet && (
                                <div className="flex items-center gap-4 text-xs text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <span>Show:</span>
                                        <select
                                            className="border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-teal-500"
                                            value={pageSize}
                                            onChange={e => {
                                                const newSize = Number(e.target.value) || 50;
                                                setPageSize(newSize);
                                                setPage(1);
                                            }}
                                        >
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-slate-50"
                                            disabled={currentPage <= 1}
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {currentPage} of {totalPages || 1}
                                        </span>
                                        <button
                                            className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-slate-50"
                                            disabled={currentPage >= totalPages}
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        >
                                            Next
                                        </button>
                                    </div>
                                    <div className="hidden sm:block text-slate-400 font-mono pl-2 border-l border-slate-200">
                                        Total Selected: <b>{totalSelected}</b>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Data Table */}
                        <div className="flex-1 overflow-auto relative">
                            {activeSheet ? (
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-slate-200 w-12 bg-slate-50">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-teal-600 focus:ring-teal-500"
                                                    checked={sheetSelections[activeSheetName!]?.selectedRowIndexes.length === activeSheet.rowCount && activeSheet.rowCount > 0}
                                                    onChange={toggleAll}
                                                />
                                            </th>
                                            {activeSheet.columns.map(col => <th key={col} className="px-4 py-3 border-b border-slate-200 whitespace-nowrap bg-slate-50 font-semibold text-slate-600">{col}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {visibleRows.map((row, localIndex) => {
                                            const globalIndex = startIndex + localIndex;
                                            return (
                                                <tr key={globalIndex} className={`hover:bg-slate-50 transition-colors ${isRowSelected(globalIndex) ? 'bg-teal-50/30' : ''}`}>
                                                    <td className="px-4 py-2 border-r border-slate-100 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isRowSelected(globalIndex)}
                                                            onChange={() => toggleRow(globalIndex)}
                                                            className="rounded text-teal-600 focus:ring-teal-500"
                                                        />
                                                    </td>
                                                    {activeSheet.columns.map(col => (
                                                        <td key={col} className="px-4 py-2 max-w-[200px] truncate border-r border-slate-50 last:border-0 text-slate-600">
                                                            {row[col]}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                        {visibleRows.length === 0 && (
                                            <tr>
                                                <td colSpan={activeSheet.columns.length + 1} className="p-8 text-center text-slate-400 italic">
                                                    No rows found on this page.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-400">Select a sheet to view data</div>
                            )}
                        </div>
                    </div>
                )}

                {loading && <div className="text-center text-slate-500"><Loader className="animate-spin inline mr-2" /> Uploading...</div>}

                <div className="flex justify-end pt-4">
                    <button
                        disabled={!workbook || totalSelected === 0}
                        onClick={() => {
                            // Prepare global columns and selected rows for next step
                            if (!workbook) return;

                            const globalColumns = Array.from(new Set(workbook.sheets.flatMap(s => s.columns)));
                            const selectedRows: any[] = [];

                            workbook.sheets.forEach(sheet => {
                                const indexes = sheetSelections[sheet.name]?.selectedRowIndexes || [];
                                indexes.forEach(idx => {
                                    if (sheet.rows[idx]) selectedRows.push(sheet.rows[idx]);
                                });
                            });

                            // Set legacy structure for Step 2 compatibility
                            setLegacyUploadedFile({
                                columns: globalColumns,
                                rows: selectedRows
                            });

                            setStep(2);
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                    >
                        Continue to Mapping <ArrowRight size={18} />
                    </button>
                    {workbook && totalSelected === 0 && (
                        <span className="text-xs text-red-500 flex items-center ml-4 font-medium">
                            <AlertCircle size={14} className="mr-1" /> Select at least one row to continue
                        </span>
                    )}
                </div>

            </div>
        );
    };


    const renderStep2 = () => {
        const currentMappingKeys = importMode === 'basic' ? Object.keys(mapping) : Object.keys(proMapping);
        const mappedCount = currentMappingKeys.length;
        const requiredFields = fields.filter(f => f.required);
        const mappedRequired = requiredFields.filter(f => currentMappingKeys.includes(f.name)).length;

        // Filter Logic
        let displayFields = fields;
        if (showRequiredOnly) {
            displayFields = displayFields.filter(f => f.required);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            displayFields = displayFields.filter(f =>
                f.string.toLowerCase().includes(term) ||
                f.name.toLowerCase().includes(term) ||
                (f.help && f.help.toLowerCase().includes(term))
            );
        }

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex gap-4">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${mappedRequired === requiredFields.length ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {mappedRequired === requiredFields.length ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                Required: {mappedRequired}/{requiredFields.length}
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
                                Total Mapped: {mappedCount}
                            </div>
                            {importMode === 'pro' && (
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                                    <Settings size={14} /> PRO Mode
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Procurar campo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8 pr-4 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-teal-500 w-48"
                                />
                                <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none border-l pl-4 border-slate-200">
                                <input
                                    type="checkbox"
                                    checked={showRequiredOnly}
                                    onChange={(e) => setShowRequiredOnly(e.target.checked)}
                                    className="rounded text-teal-600 focus:ring-teal-500"
                                />
                                Só obrigatórios
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center justify-end bg-slate-50 p-2 rounded border border-slate-200">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-1"><Key size={14} /> Unique Key</label>
                        <select
                            value={options.keyField}
                            onChange={(e) => setOptions({ ...options, keyField: e.target.value })}
                            className="text-sm border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        >
                            <option value="">(None - Create Only)</option>
                            {fields.filter(f => currentMappingKeys.includes(f.name)).map(f => (
                                <option key={f.name} value={f.name}>{f.string} ({f.name})</option>
                            ))}
                        </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={options.createIfNotExists}
                            onChange={(e) => setOptions({ ...options, createIfNotExists: e.target.checked })}
                            className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        Create if missing
                    </label>
                </div>

                {importMode === 'basic' ? (
                    <BasicMappingSection
                        displayFields={displayFields}
                        columns={legacyUploadedFile?.columns || []}
                        mapping={mapping}
                        onChange={handleMappingChange}
                    />
                ) : (
                    <ProMappingSection
                        displayFields={displayFields}
                        columns={legacyUploadedFile?.columns || []}
                        mapping={proMapping}
                        onChange={handleProMappingChange}
                    />
                )}


                <div className="flex justify-between pt-4">
                    <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-2">
                        <ArrowLeft size={18} /> Back
                    </button>
                    <button
                        disabled={mappedCount === 0 || loading}
                        onClick={handleDryRun}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                    >
                        {loading ? <Loader className="animate-spin" size={18} /> : <Play size={18} />}
                        Run Validation
                    </button>
                </div>
            </div>
        );
    };


    const renderStep3 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 mb-1">Total Rows</div>
                    <div className="text-3xl font-bold text-slate-800">{dryRunResult?.totalRows}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-green-200 shadow-sm text-center bg-green-50/50">
                    <div className="text-sm text-green-600 mb-1">Valid Rows</div>
                    <div className="text-3xl font-bold text-green-700">{dryRunResult?.validCount}</div>
                </div>
                <div className={`p-6 rounded-xl border shadow-sm text-center ${dryRunResult?.errorCount ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200'}`}>
                    <div className={`text-sm mb-1 ${dryRunResult?.errorCount ? 'text-red-600' : 'text-slate-500'}`}>Errors</div>
                    <div className={`text-3xl font-bold ${dryRunResult?.errorCount ? 'text-red-700' : 'text-slate-800'}`}>{dryRunResult?.errorCount}</div>
                </div>
            </div>

            {dryRunResult?.errors && dryRunResult.errors.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-700 font-medium">
                        <AlertCircle size={18} /> Validation Errors
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                        {dryRunResult.errors.map((err, i) => (
                            <div key={i} className="p-3 text-sm flex gap-3 hover:bg-red-50/30">
                                <span className="font-mono text-slate-400 w-12 shrink-0">Row {err.rowIndex + 2}</span>
                                <div className="text-red-600">{err.messages.join(', ')}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-between pt-4">
                <button onClick={() => setStep(2)} className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-2">
                    <ArrowLeft size={18} /> Adjust Mapping
                </button>
                <div className="flex gap-4 items-center">
                    {dryRunResult?.errorCount ? (
                        <div className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded border border-yellow-200">
                            Warning: {dryRunResult.errorCount} rows will be skipped.
                        </div>
                    ) : null}
                    <button
                        onClick={handleRunImport}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg hover:from-teal-700 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all font-bold"
                    >
                        {loading ? <Loader className="animate-spin" size={18} /> : <Database size={18} />}
                        Start Import
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="text-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle size={40} />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Import Completed!</h2>
            <p className="text-slate-500 mb-10">Your data has been processed.</p>

            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Created</div>
                    <div className="text-2xl font-bold text-green-600">{runResult?.created}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Updated</div>
                    <div className="text-2xl font-bold text-blue-600">{runResult?.updated}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Failed</div>
                    <div className="text-2xl font-bold text-red-600">{runResult?.failed}</div>
                </div>
            </div>

            {runResult?.failures && runResult.failures.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden mb-8 text-left">
                    <div className="p-3 bg-red-50 border-b border-red-100 text-red-700 font-medium text-sm">
                        Failures
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-sm">
                        {runResult.failures.map((f, i) => (
                            <div key={i} className="p-2 px-4 flex gap-3">
                                <span className="font-mono text-slate-400">Row {f.rowIndex + 2}</span>
                                <span className="text-red-600">{f.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-center gap-4">
                <Link to={`/import/${macroId}`} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors" >
                    Back to {model?.label || 'Models'}
                </Link >
                <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors flex items-center gap-2">
                    <RotateCw size={18} /> New Import
                </button>
            </div >
        </div >
    );

    if (!model && !error) return <div className="p-12 text-center text-slate-400">Loading wizard...</div>;
    if (error) return <div className="p-12 text-center text-red-500">Error: {error}</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <span className="bg-teal-100 text-teal-700 p-2 rounded-lg"><FileSpreadsheet size={24} /></span>
                        Import {model?.label}
                    </h2>
                    <p className="text-slate-500 ml-14 text-sm font-mono">{model?.model}</p>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {s}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </div>
        </div>
    );
};

export default ImportWizardPage;

