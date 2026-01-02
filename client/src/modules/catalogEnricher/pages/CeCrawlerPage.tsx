import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ceClient } from '../api/ceClient';
import { Bot, Wand2, Play, Search, Code, CheckCircle, AlertCircle, Map, GraduationCap, ArrowLeft } from 'lucide-react';
import { CeTeacherTab } from './CeTeacherTab';

export const CeCrawlerPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const profileId = searchParams.get('profileId');

    const [activeTab, setActiveTab] = useState<'auto' | 'teacher'>('auto');

    const [url, setUrl] = useState('');
    const [selectors, setSelectors] = useState({
        productCard: '',
        productName: '',
        productLink: '',
        productImage: '',
        strategy: 'single', // single, pagination, deep
        allowedPath: '',
        excludedPath: ''
    });

    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [navCandidates, setNavCandidates] = useState<any[]>([]);
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]); // Multi-select state
    const [error, setError] = useState('');

    const handleAutoDetect = async () => {
        if (!url) return;
        setLoading(true);
        setError('');
        setNavCandidates([]);
        setSelectedCandidates([]);
        try {
            const detected = await ceClient.autoDetectSelectors(url);

            if (detected.productCard) {
                setSelectors(prev => ({
                    ...prev,
                    productCard: detected.productCard,
                    productName: detected.productName,
                    productLink: detected.productLink,
                    productImage: detected.productImage
                }));
            }

            if (detected.navigationCandidates && detected.navigationCandidates.length > 0) {
                setNavCandidates(detected.navigationCandidates);
            } else if (!detected.productCard) {
                setError('Could not auto-detect products or navigation menus. Please check URL.');
            }

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeSelected = async () => {
        if (selectedCandidates.length === 0) return;
        setLoading(true);
        setError('');
        setPreviewData([]);

        try {
            const allResults: any[] = [];
            // Ideally backend handles list, for now simulate loop
            for (const candUrl of selectedCandidates) {
                try {
                    const res = await ceClient.previewCrawl(candUrl, selectors);
                    const items = res.preview.map((p: any) => ({ ...p, source: candUrl }));
                    allResults.push(...items);
                } catch (err) {
                    console.error(`Failed to preview ${candUrl}`, err);
                }
            }

            setPreviewData(allResults);
            if (allResults.length === 0) setError('No products found in the selected categories.');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async () => {
        if (!url) return;
        setLoading(true);
        setError('');
        try {
            const res = await ceClient.previewCrawl(url, selectors);
            setPreviewData(res.preview);
            if (res.totalFound === 0) setError('No products found with these selectors.');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStartExtraction = async () => {
        if (!selectors.productCard) return;
        setLoading(true);
        try {
            const entryPoints = selectedCandidates.length > 0 ? selectedCandidates : [url];
            // Send ALL entry points for partial/multi extraction
            await ceClient.startCrawl(entryPoints, selectors, profileId || undefined);
            alert(`Extraction started for ${entryPoints.length} categories! Monitor in Catalog.`);
        } catch (e: any) {
            alert('Failed to start: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleCandidate = (cUrl: string) => {
        if (selectedCandidates.includes(cUrl)) {
            setSelectedCandidates(selectedCandidates.filter(c => c !== cUrl));
        } else {
            setSelectedCandidates([...selectedCandidates, cUrl]);
        }
    };


    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 pb-32">
            <header className="flex items-center gap-4 border-b border-slate-200 pb-6">
                <button onClick={() => navigate('/catalog-enricher')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                    <Bot size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Universal Robot Crawler</h1>
                    <p className="text-slate-500">Extract product data from any website using AI detection or Manual Teaching.</p>
                </div>
            </header>

            {/* TABS */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('auto')}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'auto' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Wand2 size={16} /> Auto-Detect Mode
                </button>
                <button
                    onClick={() => setActiveTab('teacher')}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'teacher' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <GraduationCap size={16} /> Robot Teacher
                </button>
            </div>

            {activeTab === 'teacher' ? (
                <CeTeacherTab />
            ) : (
                /* EXISTING AUTO DETECT UI */
                <div className="space-y-8">
                    <div className="p-8 max-w-6xl mx-auto">
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                            <Bot size={32} className="text-purple-600" />
                            Universal Extraction Agent
                        </h1>
                        <p className="text-slate-500 mb-8 max-w-2xl">
                            Configure the robot to extract data. Use Auto-Discovery on a homepage to find categories, select the ones you want, and extract in bulk.
                        </p>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* CONFIGURATION PANEL */}
                            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
                                <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <Code size={18} /> Configuration
                                </h2>

                                <label className="block mb-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target URL</span>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="https://brand.com"
                                            className="w-full mt-1 p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={url}
                                            onChange={e => setUrl(e.target.value)}
                                        />
                                        <button
                                            onClick={handleAutoDetect}
                                            disabled={loading || !url}
                                            className="mt-1 px-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                                            title="Auto-Discovery"
                                        >
                                            <Wand2 size={16} />
                                        </button>
                                    </div>
                                </label>

                                {/* DISCOVERY RESULTS (Multi-Select) */}
                                {navCandidates.length > 0 && (
                                    <div className="mb-6 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                                                <Map size={12} /> Discovered Menus
                                            </h3>
                                            <span className="text-[10px] text-indigo-500">{selectedCandidates.length} selected</span>
                                        </div>

                                        <div className="max-h-48 overflow-y-auto space-y-1 mb-3 pr-1 custom-scrollbar">
                                            {navCandidates.map((c, i) => (
                                                <label
                                                    key={i}
                                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${selectedCandidates.includes(c.url) ? 'bg-indigo-100' : 'hover:bg-white'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 border-gray-300"
                                                        checked={selectedCandidates.includes(c.url)}
                                                        onChange={() => toggleCandidate(c.url)}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-indigo-900 truncate" title={c.url}>{c.text}</div>
                                                        <div className="text-[10px] text-indigo-400 truncate">{c.url}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>

                                        <button
                                            onClick={handleAnalyzeSelected}
                                            disabled={selectedCandidates.length === 0 || loading}
                                            className="w-full py-1.5 bg-indigo-600 text-white text-xs font-bold rounded shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                        >
                                            Analyze {selectedCandidates.length} Categories
                                        </button>
                                    </div>
                                )}

                                {/* SCOPE SETTINGS */}
                                <div className="mb-6 border-b border-slate-100 pb-6">
                                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                                        <CheckCircle size={14} className="text-green-600" /> Scope & Safety
                                    </h3>

                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-xs font-semibold text-slate-500">Strategy</span>
                                            <select
                                                className="w-full mt-1 p-2 border border-slate-200 bg-slate-50 rounded text-sm outline-none"
                                                value={selectors.strategy}
                                                onChange={e => setSelectors({ ...selectors, strategy: e.target.value })}
                                            >
                                                <option value="single">Single Page Only</option>
                                                <option value="pagination">Follow Pagination</option>
                                                <option value="deep">Deep Crawl (Follow sub-categories)</option>
                                            </select>
                                        </div>
                                        {(selectors.strategy === 'deep' || selectors.strategy === 'pagination') && (
                                            <>
                                                <div>
                                                    <span className="text-xs font-semibold text-slate-500">Allowed Path Pattern</span>
                                                    <input
                                                        type="text"
                                                        placeholder="/products/*"
                                                        className="w-full mt-1 p-2 border border-slate-200 bg-slate-50 rounded text-sm font-mono placeholder-slate-300"
                                                        value={selectors.allowedPath}
                                                        onChange={e => setSelectors({ ...selectors, allowedPath: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-semibold text-slate-500">Exclude Pattern</span>
                                                    <input
                                                        type="text"
                                                        placeholder="/news, /blog"
                                                        className="w-full mt-1 p-2 border border-slate-200 bg-slate-50 rounded text-sm font-mono placeholder-slate-300"
                                                        value={selectors.excludedPath}
                                                        onChange={e => setSelectors({ ...selectors, excludedPath: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="font-bold text-slate-700 text-sm mb-2">Selectors</h3>
                                    <div>
                                        <span className="text-xs font-semibold text-slate-500">Product Card</span>
                                        <input
                                            type="text"
                                            className="w-full mt-1 p-2 border border-slate-200 bg-slate-50 rounded text-sm font-mono"
                                            value={selectors.productCard}
                                            onChange={e => setSelectors({ ...selectors, productCard: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-slate-500">Name Selector</span>
                                        <input
                                            type="text"
                                            className="w-full mt-1 p-2 border border-slate-200 bg-slate-50 rounded text-sm font-mono"
                                            value={selectors.productName}
                                            onChange={e => setSelectors({ ...selectors, productName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-slate-500">Link Selector</span>
                                        <input
                                            type="text"
                                            className="w-full mt-1 p-2 border border-slate-200 bg-slate-50 rounded text-sm font-mono"
                                            value={selectors.productLink}
                                            onChange={e => setSelectors({ ...selectors, productLink: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-slate-500">Image Selector</span>
                                        <input
                                            type="text"
                                            className="w-full mt-1 p-2 border border-slate-200 bg-slate-50 rounded text-sm font-mono"
                                            value={selectors.productImage}
                                            onChange={e => setSelectors({ ...selectors, productImage: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handlePreview}
                                    disabled={loading || !selectors.productCard}
                                    className="w-full mt-6 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:border-purple-500 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <span className="loading loading-spinner loading-xs"></span> : <Search size={18} />}
                                    Test Selectors
                                </button>
                                {error && <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}</div>}
                            </div>

                            {/* VISUALIZATION PANEL */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700">Live Preview</h3>
                                        {previewData.length > 0 && (
                                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                <CheckCircle size={12} /> Found {previewData.length} items (sample)
                                            </span>
                                        )}
                                    </div>

                                    {previewData.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-80 text-slate-400">
                                            <Search size={48} className="mb-4 text-slate-200" />
                                            <p>Enter URL and use Auto-Discovery to find products</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                                    <tr>
                                                        <th className="p-3">Image</th>
                                                        <th className="p-3">Name</th>
                                                        <th className="p-3">Source & Link</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {previewData.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-indigo-50/20">
                                                            <td className="p-3">
                                                                {item.image ? (
                                                                    <img src={item.image} className="w-12 h-12 object-cover rounded bg-white border border-slate-200" />
                                                                ) : <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-xs">No Img</div>}
                                                            </td>
                                                            <td className="p-3 font-medium text-slate-800">{item.name}</td>
                                                            <td className="p-3 text-xs">
                                                                <div className="text-indigo-500 font-bold mb-0.5 max-w-xs truncate">{item.source?.split('/').pop() || 'Unknown'}</div>
                                                                <a href={item.link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate max-w-xs block">
                                                                    {item.link}
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {previewData.length > 0 && (
                                    <div className="flex justify-end p-4 bg-green-50 border border-green-200 rounded-xl items-center gap-4">
                                        <div className="text-sm text-green-800">
                                            <strong>Looks good?</strong> Save this configuration to start the full extraction job.
                                        </div>
                                        <button
                                            onClick={handleStartExtraction}
                                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg shadow-green-200 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                                        >
                                            <Play size={18} fill="currentColor" /> Start Extraction
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* DANGER ZONE (Bottom) */}
                        <div className="mt-12 pt-8 border-t border-slate-200">
                            <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex justify-between items-center">
                                <div>
                                    <h3 className="text-red-800 font-bold mb-1">Danger Zone</h3>
                                    <p className="text-red-600 text-sm">Clear all extracted products for this brand profile. This action cannot be undone.</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!profileId) return alert('No profile context');
                                        if (window.confirm('Are you sure you want to DELETE ALL products for this brand?')) {
                                            try {
                                                await ceClient.clearCatalogProducts(profileId);
                                                alert('Data cleared successfully.');
                                                setPreviewData([]);
                                            } catch (e: any) { alert(e.message); }
                                        }
                                    }}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors"
                                >
                                    Clear Extracted Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
