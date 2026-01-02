import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Upload, FileSpreadsheet, Check, AlertCircle, Play, ChevronRight, Loader2 } from 'lucide-react';
import { ceClient } from '../api/ceClient';

export const CeImportWizardPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const profileId = searchParams.get('profileId');

    // State
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [uploadData, setUploadData] = useState<{ id: string, headers: string[], sheets: string[] } | null>(null);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [startRow, setStartRow] = useState<string>('');
    const [endRow, setEndRow] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [jobStarted, setJobStarted] = useState<string | null>(null);

    // Step 1: Upload File
    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const res = await ceClient.uploadCatalog(file) as any; // Type assertion since we added sheets
            setUploadData({ id: res.id, headers: res.headers, sheets: res.sheets || [] });

            // Auto-select defaults
            if (res.headers.length > 0) setSelectedColumn(res.headers[0]);
            if (res.sheets && res.sheets.length > 0) setSelectedSheet(res.sheets[0]);

            setStep(2);
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Start Enrichment Job
    const handleStartJob = async () => {
        if (!uploadData || !selectedColumn || !profileId) return;
        setLoading(true);
        try {
            // We reuse the 'enrich' type which requires an uploadId and urlColumn
            // In this context, urlColumn is the Reference Key used by the Adapter/Pattern
            const res = await fetch('/api/catalog-enricher/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'enrich',
                    profileId,
                    uploadId: uploadData.id,
                    urlColumn: selectedColumn,
                    sheetName: selectedSheet,
                    startRow: startRow ? parseInt(startRow) : undefined,
                    endRow: endRow ? parseInt(endRow) : undefined,
                    download: true, // Auto-download images
                    validateLinks: true
                })
            });

            if (!res.ok) throw new Error('Failed to start job');
            const data = await res.json();

            // Show Success State instead of navigating
            setJobStarted(data.jobId);
        } catch (err: any) {
            setError(err.message || 'Failed to start job');
            setLoading(false);
        }
    };

    if (!profileId) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle size={24} />
                    <div>
                        <h3 className="font-bold">Missing Profile Context</h3>
                        <p className="text-sm">Please start this wizard from a Brand Dossier.</p>
                    </div>
                </div>
                <button onClick={() => navigate('/catalog-enricher/dossiers')} className="mt-4 text-slate-600 hover:underline">Go to Dossiers</button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => navigate(-1)} className="mb-6 text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors">
                <ArrowLeft size={16} /> Back to Dossier
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
                    <div className="p-3 bg-green-100 text-green-600 rounded-xl">
                        <FileSpreadsheet size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Import Excel Catalog</h1>
                        <p className="text-slate-500">
                            {step === 1 ? 'Step 1: Upload your product list' : 'Step 2: Map Data Columns'}
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* File Upload Area */}
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 transition-colors cursor-pointer relative group">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                aria-label="Upload File"
                                title="Upload File"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => {
                                    if (!e.target.files || e.target.files.length === 0) {
                                        setFile(null);
                                        return;
                                    }
                                    setFile(e.target.files[0]);
                                }}
                            />
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={32} />
                            </div>
                            {file ? (
                                <div>
                                    <p className="text-green-600 font-bold text-lg mb-1 flex items-center justify-center gap-2">
                                        <Check size={20} /> {file.name}
                                    </p>
                                    <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                                    <p className="text-xs text-slate-400 mt-2">Click to replace</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-slate-800 font-bold text-lg mb-1">Click to upload or drag and drop</p>
                                    <p className="text-slate-500 text-sm">Supports .xlsx, .xls, .csv</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleUpload}
                                disabled={!file || loading}
                                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <span className="flex items-center gap-2">Next Step <ChevronRight size={18} /></span>}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && uploadData && !jobStarted && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">

                        <div className="grid grid-cols-2 gap-8 mb-6">
                            {/* Column Selection */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Select Reference Column</label>
                                <p className="text-xs text-slate-500 mb-2">Column containing the SKU/Code.</p>
                                <select
                                    value={selectedColumn}
                                    onChange={(e) => setSelectedColumn(e.target.value)}
                                    title="Reference Column"
                                    aria-label="Reference Column"
                                    className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                                >
                                    {uploadData.headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sheet Selection */}
                            {uploadData.sheets && uploadData.sheets.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Select Sheet</label>
                                    <p className="text-xs text-slate-500 mb-2">Excel sheet to process.</p>
                                    <select
                                        value={selectedSheet}
                                        onChange={(e) => setSelectedSheet(e.target.value)}
                                        title="Select Sheet"
                                        aria-label="Select Sheet"
                                        className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm"
                                    >
                                        {uploadData.sheets.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Range Selection */}
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Execution Range (Optional)</label>
                            <div className="flex gap-4 items-center">
                                <input
                                    type="number"
                                    placeholder="Start Row (e.g., 1)"
                                    value={startRow}
                                    onChange={e => setStartRow(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <span className="text-slate-400 font-bold">-</span>
                                <input
                                    type="number"
                                    placeholder="End Row (e.g., 5)"
                                    value={endRow}
                                    onChange={e => setEndRow(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Leave empty to process all rows. Use this for testing small batches.</p>
                        </div>

                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 mb-8">
                            <h4 className="font-bold text-purple-800 text-sm mb-1">AI Pattern Matching</h4>
                            <p className="text-xs text-purple-600">The robot will use the code from <strong>[{selectedColumn}]</strong> to locate the product page automatically.</p>
                        </div>

                        <div className="flex justify-between items-center mt-8">
                            <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 font-medium px-4">Back</button>

                            <button
                                onClick={handleStartJob}
                                disabled={loading}
                                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-200 flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Play size={20} /> Start Universal Robot</>}
                            </button>
                        </div>
                    </div>
                )}

                {jobStarted && (
                    <div className="text-center py-8 animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Magic Started!</h2>
                        <p className="text-slate-500 mb-8">
                            The robot is now running in the background.<br />
                            It is scanning <strong>{uploadData?.headers.length ? 'your list' : 'the catalog'}</strong> and finding products.
                        </p>

                        <div className="bg-slate-50 p-4 rounded-xl mb-8 max-w-sm mx-auto border border-slate-200">
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Job ID</p>
                            <p className="font-mono text-lg font-bold text-slate-700">{jobStarted}</p>
                        </div>

                        <button
                            onClick={() => navigate(`/catalog-enricher/dossiers/${profileId}`)}
                            className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
                        >
                            Track Progress <ChevronRight size={20} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
