import { X, ExternalLink, Image as ImageIcon, FileText, Box, Download, CheckCircle, AlertTriangle, Package, Layers, Hash, Calendar } from 'lucide-react';

interface Props {
    item: any;
    onClose: () => void;
}

export const CeProductSheet = ({ item, onClose }: Props) => {
    if (!item) return null;

    // Robust Parser
    const parseJson = (input: any) => {
        if (!input) return [];
        if (Array.isArray(input)) return input;
        try { return JSON.parse(input); } catch (e) { return []; }
    };

    const gallery = parseJson(item.gallery_json);
    const files = parseJson(item.file_urls_json);
    const variants = parseJson(item.variants_json);
    const associatedProducts = parseJson(item.associated_products_json);
    const features = parseJson(item.features_json);

    // Helpers
    const getFileIcon = (format: string) => {
        const f = (format || '').toLowerCase();
        if (['dwg', 'dxf', 'step', 'stp', '3d'].some(x => f.includes(x))) return <Box size={20} className="text-blue-600" />;
        if (f.includes('pdf')) return <FileText size={20} className="text-red-500" />;
        return <Download size={20} className="text-slate-400" />;
    };

    const StatusBadge = ({ status }: { status: string }) => {
        if (status === 'ok') return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-green-100 text-green-700 tracking-wide"><CheckCircle size={12} /> Validated Product</span>;
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-100 text-red-700 tracking-wide"><AlertTriangle size={12} /> {status}</span>;
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={onClose} />

            {/* Drawer Panel */}
            <div className="relative w-full max-w-5xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">

                {/* 1. Modern Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start bg-white z-10 sticky top-0">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <StatusBadge status={item.status} />
                            <span className="text-slate-400 font-mono text-sm">{item.key_value}</span>
                        </div>
                        <h2 className="text-3xl font-extrabold text-slate-900 leading-tight tracking-tight">
                            {item.product_name || item.key_value || 'Unknown Product'}
                        </h2>
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                            <Layers size={14} className="text-blue-500" />
                            {item.category_name || 'Uncategorized'}

                            {item.collection_name && <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-600">{item.collection_name}</span>
                            </>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href={item.product_url} target="_blank" className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 border border-slate-200">
                            Open Website <ExternalLink size={14} />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition-colors"
                            title="Close Product Sheet"
                            aria-label="Close Product Sheet"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50">
                    <div className="p-8 space-y-10 max-w-5xl mx-auto">

                        {/* 2. Hero Section */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-8">
                            {/* Main Image */}
                            <div className="lg:w-1/3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center p-8 relative group overflow-hidden">
                                {item.image_url ? (
                                    <img src={item.image_url} className="w-full h-64 object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" alt="Main" />
                                ) : (
                                    <div className="text-slate-300 flex flex-col items-center gap-2">
                                        <ImageIcon size={48} />
                                        <span className="text-xs font-bold uppercase">No Image</span>
                                    </div>
                                )}
                                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-slate-500 shadow-sm border border-slate-100">HERO</div>
                            </div>

                            {/* Metadata Grid */}
                            <div className="lg:w-2/3 grid grid-cols-2 gap-x-8 gap-y-6">
                                <div>
                                    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1"><Hash size={12} /> Item Reference</h4>
                                    <div className="text-lg font-medium text-slate-800 font-mono">{item.guessed_code || item.itemReference || '-'}</div>
                                </div>
                                <div>
                                    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1"><Calendar size={12} /> Extracted At</h4>
                                    <div className="text-sm font-medium text-slate-700">{item.updated_at ? new Date(item.updated_at).toLocaleString() : 'Just now'}</div>
                                </div>

                                <div className="col-span-2 pt-4 border-t border-slate-100">
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                            <div className="text-2xl font-bold text-blue-600">{gallery.length}</div>
                                            <div className="text-[10px] font-bold text-blue-400 uppercase">Images</div>
                                        </div>
                                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                                            <div className="text-2xl font-bold text-purple-600">{files.length}</div>
                                            <div className="text-[10px] font-bold text-purple-400 uppercase">Documents</div>
                                        </div>
                                        <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                                            <div className="text-2xl font-bold text-slate-600">{variants.length}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Variants</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Multimedia Gallery */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <ImageIcon className="text-blue-500" /> Media Gallery
                                </h3>
                                {gallery.length === 0 && <span className="text-xs text-slate-400 italic">No additional images found</span>}
                            </div>

                            {gallery.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {gallery.map((img: string, i: number) => (
                                        <a key={i} href={img} target="_blank" className="group aspect-square bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden relative cursor-zoom-in">
                                            <img src={img} alt={`Gallery ${i}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1.5 rounded-lg shadow-sm">
                                                <ExternalLink size={12} className="text-slate-700" />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 4. Technical Files */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Box className="text-purple-500" /> Downloads & CAD
                                </h3>
                                {files.length === 0 && <span className="text-xs text-slate-400 italic">No documents found</span>}
                            </div>

                            {files.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {files.map((f: any, i: number) => (
                                        <a key={i} href={f.url} target="_blank" className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
                                                {getFileIcon(f.format)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-slate-700 truncate group-hover:text-purple-700 transition-colors">{f.name || 'Untitled File'}</div>
                                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                                    <span className="uppercase font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{f.format || 'FILE'}</span>
                                                    <span className="truncate opacity-50">{f.url.split('/').pop()}</span>
                                                </div>
                                            </div>
                                            <Download size={16} className="text-slate-300 group-hover:text-purple-500 transition-colors" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 5. Associated Products */}
                        {associatedProducts.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                                    <Package className="text-blue-500" /> Associated Articles & Sets
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {associatedProducts.map((p: any, i: number) => (
                                        <a key={i} href={p.url} target="_blank" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-all group">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                <Hash size={16} className="text-blue-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-slate-700 truncate">{p.article || 'Ref: ' + (p.id || 'Unknown')}</div>
                                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{p.type || 'Component'}</div>
                                            </div>
                                            {p.url && <ExternalLink size={12} className="text-slate-300 group-hover:text-blue-500" />}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 6. Finishes & Features */}
                        {features && (Object.keys(features).length > 0) && (() => {
                            const featureEntries = Array.isArray(features)
                                ? [['Available Finishes', features]]
                                : Object.entries(features);

                            return (
                                <div className="space-y-6">
                                    {featureEntries.map(([key, group]: any) => {
                                        // Handle both Ritmonio (array of objects) and standard (key-value strings)
                                        const isStandardFeature = typeof group === 'string' || typeof group === 'number';

                                        if (isStandardFeature) {
                                            return (
                                                <div key={key} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors px-2 rounded">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{key.replace(/_/g, ' ')}</span>
                                                    <span className="text-sm text-slate-700 font-medium">{group}</span>
                                                </div>
                                            );
                                        }

                                        const finishes = Array.isArray(group) ? group : (group.items || []);
                                        if (finishes.length === 0) return null;

                                        const label = isNaN(Number(key))
                                            ? key.replace(/([A-Z])/g, ' $1').trim()
                                            : 'Available Finishes';

                                        return (
                                            <div key={key} className="mb-4 last:mb-0">
                                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <Layers size={14} /> {label}
                                                </h3>
                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                    {finishes.map((f: any, i: number) => {
                                                        const finishName = typeof f.name === 'object'
                                                            ? (f.name.en || f.name.it || Object.values(f.name)[0])
                                                            : (f.name || 'Finish');

                                                        return (
                                                            <div key={i} className="group flex flex-col items-center bg-white p-2 rounded-xl border border-slate-200 hover:shadow-md transition-all">
                                                                <div className="w-full aspect-square bg-slate-100 rounded-lg overflow-hidden mb-2 relative">
                                                                    {(f.image || f.preview) ? (
                                                                        <img
                                                                            src={f.image || f.preview}
                                                                            alt={finishName}
                                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                                                            onError={(e) => {
                                                                                (e.target as HTMLImageElement).src = 'https://placehold.co/200x200?text=' + encodeURIComponent(finishName);
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={20} /></div>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-800 text-center line-clamp-1" title={finishName}>
                                                                    {finishName}
                                                                </div>
                                                                <div className="text-[9px] font-mono text-slate-400">{f.code}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        {/* 7. Variants Table */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Package className="text-orange-500" /> Variants Configuration
                                </h3>
                                {variants.length === 0 && <span className="text-xs text-slate-400 italic">Single product (No variants)</span>}
                            </div>

                            {variants.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                                            <tr>
                                                <th className="p-4 w-1/3">Code / SKU</th>
                                                <th className="p-4">Dimension / Model</th>
                                                <th className="p-4 text-right">Specifics</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {variants.map((v: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-mono text-slate-700 font-medium">{v.variant_code || '-'}</td>
                                                    <td className="p-4 text-slate-600">{v.dimension}</td>
                                                    <td className="p-4 text-right">
                                                        {v.pdf_urls && v.pdf_urls.length > 0 && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                                                <FileText size={10} /> {v.pdf_urls.length} PDF
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-100">
                                            <tr>
                                                <td colSpan={3} className="p-3 text-center text-xs text-slate-400">
                                                    Showing {variants.length} extracted variants
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Debugging (Hidden but useful) */}
                        <div className="pt-10 border-t border-dashed border-slate-200">
                            <details className="text-xs text-slate-400 cursor-pointer">
                                <summary className="hover:text-slate-600">Raw Data Inspector</summary>
                                <pre className="mt-4 p-4 bg-slate-900 text-green-400 rounded-lg overflow-x-auto font-mono">
                                    {JSON.stringify(item, null, 2)}
                                </pre>
                            </details>
                        </div>

                    </div>

                    {/* Footer Spacer */}
                    <div className="h-12" />
                </div>
            </div>
        </div>
    );
};
