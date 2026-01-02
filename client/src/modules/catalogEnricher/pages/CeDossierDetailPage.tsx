import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ceClient, CeJob } from '../api/ceClient';
import { ArrowLeft, Play, FileText, Database, Settings, Clock, Globe, Trash2 } from 'lucide-react';
import CeDossierEditor from '../components/CeDossierEditor';

const CeDossierDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [jobs, setJobs] = useState<CeJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);

    const load = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // Fetch Profiles to find this one
            const profiles = await ceClient.getProfiles();
            const p = profiles.find((x: any) => x.id === id);
            setProfile(p);

            // Fetch Jobs for this Profile
            const j = await ceClient.getJobs(id);
            setJobs(j);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen text-slate-400">
            <span className="loading loading-spinner loading-lg"></span>
        </div>
    );

    if (!profile) return (
        <div className="p-12 text-center">
            <h2 className="text-xl font-bold text-slate-800">Dossier not found</h2>
            <button onClick={() => navigate('/catalog-enricher/dossiers')} className="text-purple-600 mt-4 hover:underline">Back to Dossiers</button>
        </div>
    );

    return (
        <div className="p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            {/* Header */}
            <button onClick={() => navigate('/catalog-enricher/dossiers')} className="mb-6 text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors">
                <ArrowLeft size={16} /> Back to Brand Dossiers
            </button>

            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-8">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-yellow-100 text-yellow-600 rounded-xl shadow-sm">
                            <Database size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">{profile.name}</h1>
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-mono mt-1">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">{profile.auth_required ? 'Private (B2B)' : 'Public'}</span>
                                <span>{profile.domain_root}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate(`/catalog-enricher/catalog?profileId=${profile.id}`)}
                        className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 hover:bg-indigo-100 flex items-center gap-2 font-medium transition-all shadow-sm"
                    >
                        <Globe size={18} /> Web Catalog
                    </button>
                    <button
                        onClick={() => setShowEditor(true)}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 flex items-center gap-2 font-medium transition-all shadow-sm hover:shadow"
                    >
                        <Settings size={18} /> Settings
                    </button>
                    <button onClick={() => navigate(`/catalog-enricher/crawler?profileId=${profile.id}`)} className="px-5 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex items-center gap-2 font-bold shadow-lg shadow-purple-200 transition-all hover:scale-105 active:scale-95">
                        <Play size={18} fill="currentColor" /> Open Robot Crawler
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 gap-6">
                {/* Tables List */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center backdrop-blur-sm">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">Work Tables & Catalogs</h3>
                            <p className="text-xs text-slate-500">History of imports linked to {profile.name}</p>
                        </div>
                        <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-slate-600 border border-slate-200 shadow-sm">{jobs.length} files</span>
                    </div>

                    {jobs.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 bg-slate-50/30">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <FileText size={32} />
                            </div>
                            <h4 className="text-slate-600 font-medium mb-1">No tables yet</h4>
                            <p className="text-sm mb-6">Import your first Excel catalog for this brand.</p>
                            <button onClick={() => navigate('/catalog-enricher/wizard')} className="text-purple-600 font-medium hover:underline">Start New Import</button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {jobs.map(job => (
                                <div
                                    key={job.id}
                                    onClick={() => navigate(`/catalog-enricher/report/${job.id}`)}
                                    className="p-5 hover:bg-purple-50/50 cursor-pointer flex items-center gap-4 transition-colors group"
                                >
                                    <div className={`p-3 rounded-xl transition-colors ${job.status === 'completed' ? 'bg-green-100 text-green-600' :
                                        job.status === 'failed' ? 'bg-red-100 text-red-600' :
                                            'bg-blue-100 text-blue-600'}`}>
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-semibold text-slate-800 truncate">Import Job #{job.id.slice(0, 8)}</h4>
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                job.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>{job.status}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(job.createdAt).toLocaleString()}</span>
                                            {job.resultSummary && <span>• {job.resultSummary.totalItems} items</span>}
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('Delete this job history?')) {
                                                    ceClient.deleteJob(job.id).then(() => load());
                                                }
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Job"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <span className="text-purple-600 text-sm font-medium pr-2">View Report →</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions for Excel Import */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div
                    onClick={() => navigate(`/catalog-enricher/wizard?profileId=${profile.id}`)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md cursor-pointer group transition-all"
                >
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4 group-hover:scale-110 transition-transform">
                        <FileText size={24} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Option A: Import Excel</h3>
                    <p className="text-slate-500 text-sm">Upload a list of product codes (Ref, Name) and use the AI pattern to find their URLs automatically.</p>
                </div>

                <div
                    onClick={() => navigate(`/catalog-enricher/crawler?profileId=${profile.id}`)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md cursor-pointer group transition-all"
                >
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                        <Play size={24} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Option B: Universal Robot</h3>
                    <p className="text-slate-500 text-sm">Don't have an Excel? Let the robot scan the website structure and extract everything for you.</p>
                </div>
            </div>

            {
                showEditor && (
                    <CeDossierEditor
                        profile={profile}
                        onClose={() => setShowEditor(false)}
                        onSaved={() => { setShowEditor(false); load(); }}
                    />
                )
            }
        </div >
    );
};

export default CeDossierDetailPage;
