import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ceClient } from '../api/ceClient';
import { Folder, Plus, Grid, MoreVertical, ExternalLink, ArrowLeft } from 'lucide-react';
import CeDossierEditor from '../components/CeDossierEditor';

const COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500'];

const CeDossiersPage = () => {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingProfile, setEditingProfile] = useState<any>(null);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const handleEdit = (profile: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProfile(profile);
        setShowEditor(true);
        setActiveMenu(null);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this dossier? This cannot be undone.")) return;

        try {
            await ceClient.deleteProfile(id);
            setProfiles(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error(err);
            alert("Failed to delete profile");
        }
        setActiveMenu(null);
    };

    const loadProfiles = () => {
        setLoading(true);
        ceClient.getProfiles()
            .then(setProfiles)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadProfiles(); }, []);

    if (loading && profiles.length === 0) {
        return <div className="p-12 text-center text-slate-400 animate-pulse">Loading dossiers...</div>;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
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
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Folder className="text-purple-600" />
                            Brand Dossiers
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">Manage your trained supplier profiles and rule sets.</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/catalog-enricher/recipes')}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
                    >
                        Manage Recipes
                    </button>
                    <button
                        onClick={() => setShowEditor(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium"
                    >
                        <Plus size={18} />
                        New Dossier
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Create Card (First Item) */}
                <button
                    onClick={() => setShowEditor(true)}
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all gap-3 min-h-[180px]"
                >
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                        <Plus size={24} />
                    </div>
                    <span className="font-medium">Create New Brand Folder</span>
                </button>

                {/* Profile Cards */}
                {profiles.map((brand, i) => (
                    <div key={brand.id} onClick={() => navigate(`/catalog-enricher/dossiers/${brand.id}`)} className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden">
                        {/* Color Strip */}
                        <div className={`h-1.5 w-full ${COLORS[i % COLORS.length]}`}></div>

                        <div className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-lg text-slate-600 mb-3 border border-slate-200">
                                    {(brand.name || '?').substring(0, 1).toUpperCase()}
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenu(activeMenu === brand.id ? null : brand.id);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                                        title="More Options"
                                        aria-label="More Options"
                                    >
                                        <MoreVertical size={16} />
                                    </button>

                                    {activeMenu === brand.id && (
                                        <div className="absolute right-0 top-8 bg-white rounded-lg shadow-xl border border-slate-100 w-48 z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                            <button
                                                onClick={(e) => handleEdit(brand, e)}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-purple-600 font-medium transition-colors"
                                            >
                                                Edit Dossier
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Navigate to Config > Credentials with return context
                                                    navigate(`/connection?tab=credentials&returnUrl=/catalog-enricher/dossiers`);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 font-medium transition-colors"
                                            >
                                                Access Credentials
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(brand.id, e)}
                                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 font-medium transition-colors border-t border-slate-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-purple-600 transition-colors truncate">{brand.name}</h3>
                            {brand.domain_root ? (
                                <a href={brand.domain_root} target="_blank" onClick={e => e.stopPropagation()} className="text-xs text-slate-400 flex items-center gap-1 hover:text-blue-500 mb-4 truncate">
                                    {brand.domain_root} <ExternalLink size={10} />
                                </a>
                            ) : (
                                <p className="text-xs text-slate-300 mb-4 italic">No domain set</p>
                            )}

                            <div className="flex items-center justify-between pt-4 border-t border-slate-50 text-sm text-slate-500">
                                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-md">
                                    <Grid size={14} /> 0 Catalogs
                                </span>
                                <span className="text-xs text-slate-400">
                                    {new Date(brand.createdAt || Date.now()).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

            </div>

            {showEditor && (
                <CeDossierEditor
                    profile={editingProfile}
                    onClose={() => { setShowEditor(false); setEditingProfile(null); }}
                    onSaved={() => { setShowEditor(false); setEditingProfile(null); loadProfiles(); }}
                />
            )}
        </div>
    );
};

export default CeDossiersPage;
