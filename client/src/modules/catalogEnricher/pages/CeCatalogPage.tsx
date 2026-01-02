import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ceClient } from '../api/ceClient';
import { Search, AlertTriangle, ExternalLink, RefreshCw, Database, ChevronDown, ChevronRight, Square, CheckSquare, Layers, Eye, Edit2, Trash2, Download, ArrowLeft, X, Save } from 'lucide-react';
import { CeProductSheet } from '../components/CeProductSheet';

const CategoryNode = ({ node, level = 0 }: { node: any, level?: number }) => {
    const [isOpen, setIsOpen] = useState(level < 1); // Expand first level (Brand) by default

    const hasChildren = node.children && node.children.length > 0;

    return (
        <React.Fragment>
            <tr className={`hover:bg-slate-50 transition-colors border-b border-slate-50 ${level === 0 ? 'bg-slate-50/50' : ''}`}>
                <td className={`p-3 category-node-cell tree-level-${Math.min(level, 5)}`}>
                    <div className="flex items-center gap-2">
                        {hasChildren ? (
                            <button onClick={() => setIsOpen(!isOpen)} className="text-slate-400 hover:text-purple-600 transition-colors">
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <div className="w-4" />
                        )}
                        <span className={`font-medium ${level === 0 ? 'text-slate-900 font-bold uppercase tracking-tight' : 'text-slate-700'}`}>
                            {node.name}
                        </span>
                    </div>
                </td>
                <td className="p-3 text-right pr-8">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${level === 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                        {node.count} items
                    </span>
                </td>
            </tr>
            {hasChildren && isOpen && node.children.map((child: any, i: number) => (
                <CategoryNode key={i} node={child} level={level + 1} />
            ))}
        </React.Fragment>
    );
};

export const CeCatalogPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const profileId = searchParams.get('profileId');
    const [activeTab, setActiveTab] = useState<'products' | 'structure' | 'missing'>('products');
    const [loading, setLoading] = useState(false);

    // Data State
    const [products, setProducts] = useState<any[]>([]);
    const [missing, setMissing] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [totalItems, setTotalItems] = useState(0);

    // Params State
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Editing State
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [viewingItem, setViewingItem] = useState<any | null>(null);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Load Data
    useEffect(() => {
        loadData();
    }, [activeTab, page, debouncedSearch, profileId]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'products') {
                const res = await ceClient.getCatalogProducts(page, 20, debouncedSearch, profileId || undefined);
                setProducts(res.items);
                setTotalItems(res.total);
            } else if (activeTab === 'structure') {
                const cats = await ceClient.getCatalogCategories(profileId || undefined);
                setCategories(cats);
                setTotalItems(cats.length);
            } else {
                const res = await ceClient.getMissingProducts(page, 20);
                setMissing(res.items);
                setTotalItems(res.total);
            }
            setSelectedIds([]); // Reset selection on reload
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        ceClient.exportCatalog(profileId || undefined);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === products.length && products.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(products.map(p => p.id));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleDelete = async (id?: number) => {
        if (!confirm('Are you sure you want to delete these items?')) return;

        const targets = id ? [id] : selectedIds;
        try {
            for (const t of targets) {
                await ceClient.deleteProduct(t);
            }
            loadData();
        } catch (e) {
            alert('Failed to delete');
        }
    };

    const handleSaveEdit = async () => {
        if (!editingItem) return;
        try {
            await ceClient.updateProduct(editingItem.id, {
                product_name: editingItem.product_name,
                guessed_code: editingItem.guessed_code
            });
            setEditingItem(null);
            loadData();
        } catch (e) {
            alert('Failed to update');
        }
    };

    const totalPages = Math.ceil(totalItems / 20);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/catalog-enricher')}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                        title="Back to Dashboard"
                        aria-label="Back to Dashboard"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                            <Database className="w-8 h-8 text-purple-600" />
                            Web Catalog Explorer
                            <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-200 ml-2">V3 Beta</span>
                        </h1>
                        <p className="text-gray-500 mt-1">Manage and explore the autonomous data extraction inventory.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            const types = prompt("Enter asset types (e.g. 3d, step, zip) or leave blank for default:", "3d, step, zip");
                            if (types === null) return;

                            if (confirm(`Start downloading missing assets for this profile ? This may take time.`)) {
                                setLoading(true); // Reuse loading state for simplicity or add specific state
                                ceClient.triggerAssetDownload(profileId || '', types ? types.split(',').map(s => s.trim()) : undefined)
                                    .then(res => alert(res.message))
                                    .catch(err => alert("Download Failed: " + err.message))
                                    .finally(() => setLoading(false));
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-purple-200 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium transition-colors"
                        disabled={!profileId}
                        title={!profileId ? "Select a Brand Profile first" : "Download missing 3D files"}
                    >
                        <Download size={18} /> Fetch Assets
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors">
                        <ExternalLink size={18} /> Export CSV
                    </button>
                    <button onClick={loadData} className="p-2 text-gray-600 hover:text-purple-600 transition-colors" title="Refresh Data">
                        <RefreshCw className={`w - 5 h - 5 ${loading ? 'animate-spin' : ''} `} />
                    </button>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => { setActiveTab('products'); setPage(1); }}
                        className={`px - 4 py - 2 rounded - md text - sm font - medium transition - all ${activeTab === 'products' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'} `}
                    >
                        Success Inventory
                    </button>
                    <button
                        onClick={() => { setActiveTab('structure'); setPage(1); }}
                        className={`px - 4 py - 2 rounded - md text - sm font - medium transition - all flex items - center gap - 2 ${activeTab === 'structure' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'} `}
                    >
                        Structure & Categories <Layers className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setActiveTab('missing'); setPage(1); }}
                        className={`px - 4 py - 2 rounded - md text - sm font - medium transition - all flex items - center gap - 2 ${activeTab === 'missing' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} `}
                    >
                        Missing Products <AlertTriangle className="w-4 h-4" />
                    </button>
                </div>

                {activeTab === 'products' && (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => handleDelete()}
                                className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold transition-colors animate-in fade-in"
                            >
                                <Trash2 size={16} /> Delete ({selectedIds.length})
                            </button>
                        )}
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name, code or URL..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Content Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
                {loading && products.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 animate-pulse">Loading catalog...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                                    {activeTab === 'products' ? (
                                        <>
                                            <th className="p-4 w-10 text-center">
                                                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-purple-600">
                                                    {products.length > 0 && selectedIds.length === products.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                                </button>
                                            </th>
                                            <th className="p-4 w-16">Image</th>
                                            <th className="p-4">Product Name</th>
                                            <th className="p-4">Guessed Code</th>
                                            <th className="p-4">Category</th>
                                            <th className="p-4">Last Seen</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </>
                                    ) : activeTab === 'structure' ? (
                                        <>
                                            <th className="p-4">Catálogo / Família / Coleção</th>
                                            <th className="p-4 text-right pr-8">Produtos</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-4">Searched Code</th>
                                            <th className="p-4">Brand Profile</th>
                                            <th className="p-4">Occurrences</th>
                                            <th className="p-4">Last Failed At</th>
                                            <th className="p-4 text-right">Status</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {activeTab === 'products' ? (
                                    products.map((item) => (
                                        <tr key={item.id} className={`hover: bg - gray - 50 transition - colors group ${selectedIds.includes(item.id) ? 'bg-purple-50' : ''} `}>
                                            <td className="p-4 text-center">
                                                <button onClick={() => toggleSelect(item.id)} className={`${selectedIds.includes(item.id) ? 'text-purple-600' : 'text-slate-300 hover:text-slate-500'} `}>
                                                    {selectedIds.includes(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt="" className="w-10 h-10 object-contain rounded border border-gray-200 bg-white" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400">?</div>
                                                )}
                                            </td>
                                            <td className="p-4 font-medium text-gray-900">
                                                {item.product_name}
                                                <div className="text-xs text-slate-400 font-normal truncate max-w-xs">{item.product_url}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">
                                                    {item.guessed_code || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-600">{item.category_name || '-'}</td>
                                            <td className="p-4 text-xs text-slate-500">
                                                {new Date(item.crawled_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                <button onClick={() => setViewingItem(item)} className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50" title="View Details">
                                                    <Eye size={16} />
                                                </button>
                                                <button onClick={() => setEditingItem(item)} className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Quick Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                                <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-purple-600 rounded hover:bg-purple-50" title="Open Link">
                                                    <ExternalLink size={16} />
                                                </a>
                                            </td>
                                        </tr>
                                    ))
                                ) : activeTab === 'structure' ? (
                                    categories.map((cat, idx) => (
                                        <CategoryNode key={idx} node={cat} />
                                    ))
                                ) : (
                                    missing.map((item) => (
                                        <tr key={item.id} className="hover:bg-red-50/30 transition-colors">
                                            <td className="p-4 font-mono font-bold text-red-700">{item.product_code}</td>
                                            <td className="p-4 text-slate-600">{item.brand_profile_id}</td>
                                            <td className="p-4">
                                                <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                                    {item.occurrence_count}x
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs text-slate-500">
                                                {new Date(item.last_seen_at).toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="text-xs uppercase font-bold text-red-400 tracking-wider">Missing</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab !== 'structure' && (
                    <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
                        <div>
                            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, totalItems)} of {totalItems} items
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Edit Product</h3>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="text-slate-400 hover:text-slate-600"
                                title="Close Modal"
                                aria-label="Close Modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="text-xs font-bold text-slate-500 uppercase">Product Name</span>
                                <input
                                    type="text"
                                    value={editingItem.product_name}
                                    onChange={e => setEditingItem({ ...editingItem, product_name: e.target.value })}
                                    className="w-full mt-1 p-2 border border-slate-300 rounded font-medium"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold text-slate-500 uppercase">Reference / Code</span>
                                <input
                                    type="text"
                                    value={editingItem.guessed_code}
                                    onChange={e => setEditingItem({ ...editingItem, guessed_code: e.target.value })}
                                    className="w-full mt-1 p-2 border border-slate-300 rounded font-mono text-sm text-blue-600"
                                />
                            </label>

                            <div className="pt-4 flex justify-end gap-2">
                                <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                                <button onClick={handleSaveEdit} className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-bold flex items-center gap-2">
                                    <Save size={18} /> Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Sheet Modal */}
            {viewingItem && (
                <CeProductSheet
                    item={viewingItem}
                    onClose={() => setViewingItem(null)}
                />
            )}
        </div>
    );
};
