import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CeJob } from '../api/ceClient';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { CeProductSheet } from '../components/CeProductSheet';

export const CeJobReportPage = () => {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();
    const [job, setJob] = useState<CeJob | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (jobId) loadJob();
    }, [jobId]);

    const loadJob = async () => {
        setLoading(true);
        try {
            // Need to implement getJob in client or just fetching from jobs list?
            // Assuming we might need to add getJob(id) to client, or filter.
            // For now, let's fetch profile jobs and find it, or better: implement getJob endpoint.
            // Let's try the direct endpoint GET /api/catalog-enricher/jobs/:id if it exists.
            const res = await fetch(`/api/catalog-enricher/jobs/${jobId}`);
            if (!res.ok) throw new Error('Job not found');
            const data = await res.json();
            setJob(data);

            // Fetch items for this job
            const itemsRes = await fetch(`/api/catalog-enricher/jobs/${jobId}/items`);
            if (itemsRes.ok) {
                const itemsData = await itemsRes.json();
                setItems(itemsData.items || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-400">Loading Report...</div>;
    if (!job) return <div className="p-12 text-center">Job not found</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Sheet Overlay */}
            {selectedItem && (
                <CeProductSheet
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}

            <button onClick={() => navigate(-1)} className="mb-6 text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors">
                <ArrowLeft size={16} /> Back
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-slate-900">Job Report</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${job.status === 'completed' ? 'bg-green-100 text-green-700' : job.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {job.status}
                            </span>
                        </div>
                        <p className="text-slate-500 font-mono text-sm">ID: {job.id}</p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                        <div className="flex items-center gap-2 justify-end mb-1">
                            <Clock size={14} /> Created: {new Date(job.createdAt).toLocaleString()}
                        </div>
                        {job.updatedAt && <div>Updated: {new Date(job.updatedAt).toLocaleString()}</div>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    <div className="p-6 text-center">
                        <div className="text-3xl font-bold text-slate-800 mb-1">{items.length}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Items</div>
                    </div>
                    <div className="p-6 text-center">
                        <div className="text-3xl font-bold text-green-600 mb-1">{items.filter(i => i.status === 'ok').length}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Success</div>
                    </div>
                    <div className="p-6 text-center">
                        <div className="text-3xl font-bold text-red-500 mb-1">{items.filter(i => i.status === 'error' || i.status === 'not_found').length}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Failed / Missing</div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
                    <h3>Item Details</h3>
                    <div className="text-xs text-slate-400 font-normal">Click on a row to view full product sheet</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="p-4">Reference</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">URL</th>
                                <th className="p-4">Assets found</th>
                                <th className="p-4">Category</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => {
                                const variants = item.variants_json ? JSON.parse(item.variants_json) : [];
                                const hasVariants = variants.length > 0;

                                return (
                                    <tr key={idx} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedItem(item)}>
                                        <td className="p-4 font-mono text-slate-700">
                                            {item.key_value}
                                            {hasVariants && <div className="text-xs text-slate-400 mt-1">{variants.length} variants</div>}
                                        </td>
                                        <td className="p-4">
                                            {item.status === 'ok' ? (
                                                <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> OK</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-red-500"><AlertTriangle size={14} /> {item.status}</span>
                                            )}
                                        </td>
                                        <td className="p-4 max-w-xs truncate text-blue-600">
                                            <span className="truncate block">{item.product_url}</span>
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {(() => {
                                                try {
                                                    const galleryCount = item.gallery_json ? JSON.parse(item.gallery_json).length : 0;
                                                    const filesCount = item.file_urls_json ? JSON.parse(item.file_urls_json).length : 0;
                                                    const variantAssets = variants.reduce((acc: number, v: any) => acc + (v.pdf_urls ? v.pdf_urls.length : 0), 0);

                                                    return (
                                                        <div className="flex gap-2">
                                                            {galleryCount > 0 && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs font-bold">{galleryCount} Imgs</span>}
                                                            {filesCount > 0 && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-bold">{filesCount} Files</span>}
                                                            {variantAssets > 0 && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{variantAssets} PDFs</span>}
                                                            {galleryCount === 0 && filesCount === 0 && variantAssets === 0 && <span className="text-slate-300">-</span>}
                                                        </div>
                                                    );
                                                } catch (e) { return 0; }
                                            })()}
                                        </td>
                                        <td className="p-4 text-slate-500 text-xs max-w-xs truncate">
                                            {item.category_name}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
