
import React, { useState, useEffect } from 'react';
import { ceClient } from '../api/ceClient';
import { Eye, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const CeCredentialsManager: React.FC = () => {
    const [creds, setCreds] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const returnUrl = searchParams.get('returnUrl');

    // Form State
    const [formData, setFormData] = useState({ name: '', service_url: '', username: '', password_enc: '' });
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

    useEffect(() => {
        loadCreds();
    }, []);

    const loadCreds = async () => {
        setLoading(true);
        try {
            const data = await ceClient.getCredentials();
            setCreds(data);
        } catch (e) {
            console.error(e);
            alert("Error loading credentials");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (editingItem) {
                await ceClient.updateCredential(editingItem.id, formData);
            } else {
                await ceClient.createCredential(formData);
            }
            setModalOpen(false);
            setEditingItem(null);
            setFormData({ name: '', service_url: '', username: '', password_enc: '' });
            loadCreds();

            // If we have a return context, maybe we want to go back immediately? 
            // The user said: "depois de estas estarem criadas, ou editadas, devemos retornar ao menu onde estávamos"
            // But maybe they want to edit multiple. Let's rely on the explicit Back button or just stay.
            // Actually, usually explicit back is better.
        } catch (e) {
            alert("Error saving credential");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This might break profiles using this credential.")) return;
        try {
            await ceClient.deleteCredential(id);
            loadCreds();
        } catch (e) {
            alert("Error deleting credential");
        }
    };

    const handleReveal = async (id: string) => {
        if (revealedPasswords[id]) {
            // Hide
            const next = { ...revealedPasswords };
            delete next[id];
            setRevealedPasswords(next);
        } else {
            // Show
            try {
                const res = await ceClient.revealCredential(id);
                setRevealedPasswords(prev => ({ ...prev, [id]: res.password }));
            } catch (e) {
                alert("Could not reveal password");
            }
        }
    };

    const openModal = (item?: any) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                service_url: item.service_url || '',
                username: item.username,
                password_enc: '' // Don't prefill password for security
            });
        } else {
            setEditingItem(null);
            setFormData({ name: '', service_url: '', username: '', password_enc: '' });
        }
        setModalOpen(true);
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    {returnUrl && (
                        <button
                            onClick={() => navigate(returnUrl)}
                            className="text-xs text-slate-500 hover:text-purple-600 flex items-center gap-1 mb-2"
                        >
                            <ArrowLeft size={14} /> Back to Dossiers
                        </button>
                    )}
                    <h2 className="text-xl font-bold text-slate-800">🔐 Credential Manager</h2>
                    <p className="text-sm text-slate-500">Securely store login details for B2B scrapers.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow font-medium"
                >
                    + New Credential
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Brand Name</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Service URL</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Username</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Password</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {loading && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading credentials...</td></tr>}
                        {!loading && creds.length === 0 && (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-400 italic">No credentials configured.</td></tr>
                        )}
                        {creds.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-800">{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                    <a href={item.service_url} target="_blank" rel="noreferrer" className="hover:underline truncate block max-w-[200px]">{item.service_url}</a>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{item.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs">
                                            {revealedPasswords[item.id] || "••••••••"}
                                        </span>
                                        <button
                                            onClick={() => handleReveal(item.id)}
                                            className="text-slate-400 hover:text-slate-600"
                                            title={revealedPasswords[item.id] ? "Hide Password" : "Show Password"}
                                            aria-label={revealedPasswords[item.id] ? "Hide Password" : "Show Password"}
                                        >
                                            <Eye size={14} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-3">
                                    <button
                                        onClick={() => openModal(item)}
                                        className="text-indigo-600 hover:text-indigo-800"
                                        title="Edit Credential"
                                        aria-label="Edit Credential"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-red-500 hover:text-red-700"
                                        title="Delete Credential"
                                        aria-label="Delete Credential"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                        <h2 className="text-xl font-bold mb-6 text-slate-800">{editingItem ? 'Edit Credential' : 'New Credential'}</h2>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="brandName" className="block text-sm font-medium text-slate-700 mb-1">Brand Name / Label</label>
                                <input
                                    id="brandName"
                                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                    placeholder="e.g. Ritmonio B2B"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label htmlFor="loginUrl" className="block text-sm font-medium text-slate-700 mb-1">Login URL</label>
                                <input
                                    id="loginUrl"
                                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                                    placeholder="https://area-b2b.site.com/login"
                                    title="Login URL"
                                    value={formData.service_url}
                                    onChange={e => setFormData({ ...formData, service_url: e.target.value })}
                                />
                            </div>
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">Username / Email</label>
                                <input
                                    id="username"
                                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                    placeholder="your@email.com or username"
                                    title="Username / Email"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                                    {editingItem ? 'New Password (exclude to keep current)' : 'Password'}
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                                    placeholder={editingItem ? "••••••••" : ""}
                                    title="Password"
                                    value={formData.password_enc}
                                    onChange={e => setFormData({ ...formData, password_enc: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow font-medium">Save Credential</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
