import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ceClient } from '../api/ceClient';
import { Upload, FileSpreadsheet, Play, X, ArrowRight, Database, Search, Trash2 } from 'lucide-react';

export const CeMergerPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const profileId = searchParams.get('profileId');

    // Steps: 'upload', 'rules', 'review'
    const [step, setStep] = useState('upload');
    const [pricelists, setPricelists] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(profileId);
    const [selectedPricelist, setSelectedPricelist] = useState<any | null>(null);
    const [uploading, setUploading] = useState(false);

    // Rules State
    // Rules State
    const [rules, setRules] = useState<any[]>([]);
    const [columnMapping, setColumnMapping] = useState({ sku: '', name: '', price: '' });
    const [targetSheet, setTargetSheet] = useState<string>('');
    const [startRow, setStartRow] = useState<number>(1);
    const [endRow, setEndRow] = useState<number | undefined>(undefined);

    // Review State
    const [results, setResults] = useState<any[]>([]);
    const [matchStats, setMatchStats] = useState<any>(null);
    const [loadingResults, setLoadingResults] = useState(false);

    useEffect(() => {
        loadProfiles();
    }, []);

    useEffect(() => {
        if (selectedProfileId) {
            loadPricelists();
            loadRules();
        }
    }, [selectedProfileId]);

    const loadProfiles = async () => {
        try {
            const res = await ceClient.getProfiles();
            setProfiles(res);
        } catch (e) { console.error(e); }
    };

    const loadPricelists = async () => {
        const res = await ceClient.get(`/merger/pricelists?brandProfileId=${selectedProfileId}`);
        setPricelists(res);
    };

    const loadRules = async () => {
        const res = await ceClient.get(`/merger/rules?brandProfileId=${selectedProfileId}`);
        setRules(res);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        if (!selectedProfileId) {
            alert("Por favor, selecione uma Marca primeiro.");
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', e.target.files[0]);
            formData.append('brandProfileId', selectedProfileId);
            await ceClient.post('/merger/pricelists', formData);
            await loadPricelists();
        } catch (err: any) {
            alert('Falha no upload: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePricelist = async (id: string) => {
        if (!confirm('Tem a certeza que deseja eliminar esta tabela de preços? Todos os merges associados serão perdidos.')) return;
        try {
            await ceClient.delete(`/merger/pricelists/${id}`);
            loadPricelists();
        } catch (err: any) {
            alert('Erro ao eliminar: ' + err.message);
        }
    };

    const handleSelectPricelist = (pl: any) => {
        setSelectedPricelist(pl);
        // Auto-detect mapping if possible
        if (pl.columns_json) {
            const cols = JSON.parse(pl.columns_json);
            const map: any = { sku: '', name: '', price: '' };
            cols.forEach((c: string) => {
                const lc = c.toLowerCase();
                if (lc.includes('sku') || lc.includes('code') || lc.includes('ref')) map.sku = c;
                if (lc.includes('desc') || lc.includes('name')) map.name = c;
                if (lc.includes('price') || lc.includes('cost')) map.price = c;
            });
            setColumnMapping(map);
        }
        if (pl.sheets && pl.sheets.length > 0) setTargetSheet(pl.sheets[0]);
        setStartRow(1);
        setEndRow(undefined);
        setStep('rules');
    };

    const runMatcher = async () => {
        if (!selectedPricelist) return;
        setLoadingResults(true);
        try {
            const res = await ceClient.post('/merger/match', {
                pricelistId: selectedPricelist.id,
                mapping: columnMapping
            });
            setMatchStats(res);
            setStep('review');
            loadResults();
        } catch (err) {
            alert('Matching failed');
        } finally {
            setLoadingResults(false);
        }
    };

    const loadResults = async () => {
        if (!selectedPricelist) return;
        const res = await ceClient.get(`/merger/results?pricelistId=${selectedPricelist.id}&page=1`);
        setResults(res.items);
    };

    const renderUploadStep = () => (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Brand Profile</label>
                        <select
                            title="Brand Profile Selection"
                            aria-label="Brand Profile Selection"
                            value={selectedProfileId || ''}
                            onChange={e => setSelectedProfileId(e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-slate-50 font-medium"
                        >
                            <option value="">-- Choose Brand --</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.domain_root})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className={`bg-white p-8 rounded-xl border-2 border-dashed transition-all text-center ${!selectedProfileId ? 'opacity-50 border-slate-200' : 'border-slate-300 hover:border-purple-500 cursor-pointer'}`}>
                <input
                    type="file"
                    onChange={handleUpload}
                    className="hidden"
                    id="pl-upload"
                    accept=".xlsx,.csv"
                    disabled={!selectedProfileId}
                />
                <label htmlFor="pl-upload" className={`${!selectedProfileId ? 'cursor-not-allowed' : 'cursor-pointer'} flex flex-col items-center gap-4`}>
                    <div className="p-4 bg-purple-50 rounded-full text-purple-600">
                        {uploading ? <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" /> : <Upload size={32} />}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-700">Upload Official Pricelist</h3>
                        <p className="text-sm text-slate-500">Support for .xlsx and .csv files</p>
                        {!selectedProfileId && <p className="text-xs text-red-500 mt-2 font-medium">Please select a brand profile first</p>}
                    </div>
                </label>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="p-4 font-bold text-xs text-slate-500 uppercase">Filename</th>
                            <th className="p-4 font-bold text-xs text-slate-500 uppercase">Uploaded</th>
                            <th className="p-4 font-bold text-xs text-slate-500 uppercase">Rows</th>
                            <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pricelists.map(pl => (
                            <tr key={pl.id} className="hover:bg-slate-50">
                                <td className="p-4 font-medium text-slate-700 flex items-center gap-2">
                                    <FileSpreadsheet size={16} className="text-green-600" /> {pl.filename}
                                </td>
                                <td className="p-4 text-sm text-slate-500">{new Date(pl.uploaded_at).toLocaleDateString()}</td>
                                <td className="p-4 text-slate-600 font-mono">{pl.row_count}</td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleDeletePricelist(pl.id)} className="p-1 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Pricelist">
                                            <Trash2 size={16} />
                                        </button>
                                        <button onClick={() => handleSelectPricelist(pl)} className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-bold flex items-center gap-1">
                                            Select <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {pricelists.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">No pricelists found. Upload one to start.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const runTargetedSearch = async () => {
        console.log('[TargetedSearch] Clicked', {
            selectedPricelistId: selectedPricelist?.id,
            selectedProfileId,
            skuColumn: columnMapping.sku
        });

        if (!selectedPricelist || !selectedProfileId || !columnMapping.sku) {
            console.warn('[TargetedSearch] Aborting: Missing requirements', {
                hasPricelist: !!selectedPricelist,
                hasProfile: !!selectedProfileId,
                hasSkuCol: !!columnMapping.sku
            });
            return;
        }

        if (!confirm("Confirmar Enriquecimento Direto? O robô irá pesquisar cada código no site para baixar dados (PDFs, 3D, Imagens). Isto pode demorar.")) return;

        setLoadingResults(true);
        try {
            console.log('[TargetedSearch] Calling Backend...');
            const res = await ceClient.post('/merger/targeted-enrichment', {
                pricelistId: selectedPricelist.id,
                skuColumn: columnMapping.sku,
                profileId: selectedProfileId,
                sheet: targetSheet,
                startRow,
                endRow
            });
            console.log('[TargetedSearch] Success Response:', res);
            alert("Enriquecimento Direto iniciado! Acompanha o progresso no Job Monitor.");
        } catch (err: any) {
            console.error('[TargetedSearch] Error:', err);
            alert('Falha ao iniciar: ' + err.message);
        } finally {
            setLoadingResults(false);
        }
    };

    const renderRulesStep = () => (
        <div className="space-y-6">
            {/* Configuration Bar */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Database size={20} className="text-blue-500" /> Configuration
                    </h3>
                    {rules.length > 0 && <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{rules.length} rules</span>}
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* Sheet Selection */}
                    <div className="col-span-12 md:col-span-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Sheet</label>
                        <select
                            title="Target Sheet"
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                            value={targetSheet}
                            onChange={e => setTargetSheet(e.target.value)}
                        >
                            {selectedPricelist?.sheets?.map((s: string) => (
                                <option key={s} value={s}>{s}</option>
                            )) || <option value="">Default</option>}
                        </select>
                    </div>

                    {/* Row Range */}
                    <div className="col-span-6 md:col-span-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Row</label>
                        <input
                            type="number"
                            title="Start Row"
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                            value={startRow}
                            onChange={e => setStartRow(Number(e.target.value))}
                            min={1}
                        />
                    </div>
                    <div className="col-span-6 md:col-span-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Row (Optional)</label>
                        <input
                            type="number"
                            title="End Row"
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                            value={endRow || ''}
                            onChange={e => setEndRow(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="All"
                        />
                    </div>
                </div>

                <hr className="my-6 border-slate-100" />

                {/* Column Mapping */}
                <h4 className="text-sm font-bold text-slate-700 mb-3">Column Mapping</h4>
                <div className="grid grid-cols-3 gap-6">
                    {['sku', 'name', 'price'].map(field => (
                        <div key={field}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{field} Column</label>
                            <select
                                title={`${field} Column Mapping`}
                                aria-label={`${field} Column Mapping`}
                                value={(columnMapping as any)[field]}
                                onChange={e => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                <option value="">-- Select Column --</option>
                                {selectedPricelist?.columns_json && JSON.parse(selectedPricelist.columns_json).map((c: string) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl">
                <button onClick={() => setStep('upload')} className="text-slate-500 hover:text-slate-800 font-medium">Back</button>
                <div className="flex gap-4">
                    <button
                        onClick={runTargetedSearch}
                        disabled={loadingResults || !columnMapping.sku}
                        className="px-6 py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-2 transition-all"
                        title="Search for each SKU on the web and extract data"
                    >
                        {loadingResults ? <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" /> : <Search size={20} />}
                        Targeted Enrichment
                    </button>
                    {/* Matcher button disabled temporarily as per user request to fix "Targeted Enrichment" first */}
                    <button
                        onClick={runMatcher}
                        disabled={loadingResults || !columnMapping.sku}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-bold shadow-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-all opacity-50 cursor-not-allowed"
                        title="Matcher disabled until Enrichment is verified"
                    >
                        <Play size={20} /> Run Matcher Engine
                    </button>
                </div>
            </div>
        </div>
    );

    const renderReviewStep = () => (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header / Stats */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Merge Results</h3>
                    {matchStats && <p className="text-sm text-green-600 font-medium">Matched {matchStats.matches} of {matchStats.total} items</p>}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setStep('rules')} className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-50 text-sm font-medium">Adjust Rules</button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 w-1/3 bg-slate-50">Excel Data (Master)</th>
                                <th className="p-3 w-8 bg-slate-50"></th>
                                <th className="p-3 w-1/3 bg-slate-50">Web Data (Enriched)</th>
                                <th className="p-3 bg-slate-50 text-right">Similarity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {results.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 group">
                                    <td className="p-3 align-top">
                                        <div className="font-mono text-slate-900 font-medium">{item.final_sku}</div>
                                        <div className="text-slate-600 text-xs truncate max-w-xs">{item.final_name}</div>
                                        {item.final_price > 0 && <div className="text-slate-500 text-xs mt-1">{item.final_price?.toFixed(2)}</div>}
                                    </td>

                                    <td className="p-3 align-middle text-center text-slate-300">
                                        {item.match_confidence > 80 ? <ArrowRight size={16} className="text-green-500" /> : <X size={16} />}
                                    </td>

                                    <td className="p-3 align-top">
                                        {item.web_product_id ? (
                                            <div className="flex gap-3">
                                                {item.web_image ? (
                                                    <img
                                                        src={item.web_image}
                                                        alt={item.web_name || 'Product'}
                                                        title={item.web_name || 'Product'}
                                                        className="w-12 h-12 object-contain bg-white border border-slate-200 rounded"
                                                    />
                                                ) : <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400">No Img</div>}
                                                <div className="min-w-0">
                                                    <div className="font-bold text-indigo-700 text-xs truncate max-w-xs">{item.web_name}</div>
                                                    <div className="text-[10px] bg-indigo-50 text-indigo-600 px-1 rounded inline-block mt-1 font-mono">{item.web_code}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-slate-400 italic text-xs py-2 flex items-center gap-2">
                                                <Search size={14} /> No match found
                                            </div>
                                        )}
                                    </td>

                                    <td className="p-3 text-right">
                                        {item.match_confidence > 0 && (
                                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${item.match_confidence > 90 ? 'bg-green-100 text-green-700' : 'bg-yellow-50 text-yellow-600'}`}>
                                                {item.match_confidence}%
                                            </span>
                                        )}
                                        <div className="text-[10px] text-slate-400 mt-1 uppercase">{item.match_method}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FileSpreadsheet className="text-purple-600" /> Smart Catalog Merger
            </h1>

            {/* Stepper */}
            <div className="flex items-center gap-4 mb-8 text-sm font-medium text-slate-400">
                <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-purple-600' : ''}`}>1. Upload</div>
                <div className="h-px w-8 bg-slate-200" />
                <div className={`flex items-center gap-2 ${step === 'rules' ? 'text-purple-600' : ''}`}>2. Match & Rules</div>
                <div className="h-px w-8 bg-slate-200" />
                <div className={`flex items-center gap-2 ${step === 'review' ? 'text-purple-600' : ''}`}>3. Review</div>
            </div>

            <div className="flex-1 min-h-0">
                {step === 'upload' && renderUploadStep()}
                {step === 'rules' && renderRulesStep()}
                {step === 'review' && renderReviewStep()}
            </div>
        </div>
    );
};
