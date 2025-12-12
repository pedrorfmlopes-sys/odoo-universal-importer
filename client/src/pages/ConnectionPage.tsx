import { useEffect, useState } from 'react';
import { apiClient, OdooConfig } from '../api/apiClient';
import { Save, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const ConnectionPage = () => {
    const [config, setConfig] = useState<OdooConfig>({
        url: '',
        db: '',
        userEmail: '',
        apiKey: ''
    });
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await apiClient.getOdooConfig();
            if (data) setConfig(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: 'idle', message: '' });
        try {
            await apiClient.saveOdooConfig(config);
            setStatus({ type: 'success', message: 'Configuration saved successfully!' });
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'Failed to save configuration' });
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setStatus({ type: 'idle', message: '' });
        try {
            const res = await apiClient.testOdooConfig();
            if (res.success) {
                setStatus({ type: 'success', message: 'Connection Successful! Odoo is reachable.' });
            } else {
                setStatus({ type: 'error', message: res.message || 'Connection failed' });
            }
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'Verification failed check console' });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">Connection Settings</h2>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-slate-600 text-sm">
                        Enter your Odoo instance details below. You need to enable "External API" logic on Odoo side
                        and generate an API Key for your user.
                    </p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Odoo URL</label>
                                <input
                                    type="url"
                                    name="url"
                                    placeholder="https://my-odoo-instance.com"
                                    value={config.url}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Database Name</label>
                                <input
                                    type="text"
                                    name="db"
                                    placeholder="odoo-db-name"
                                    value={config.db}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">User Email</label>
                                <input
                                    type="email"
                                    name="userEmail"
                                    placeholder="admin@example.com"
                                    value={config.userEmail}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">API Key / Password</label>
                                <input
                                    type="password"
                                    name="apiKey"
                                    placeholder="••••••••••••"
                                    value={config.apiKey}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all font-mono"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Import Mode</label>
                                <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, importMode: 'basic' })}
                                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${config.importMode !== 'pro' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Basic (Simple)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, importMode: 'pro' })}
                                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${config.importMode === 'pro' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Pro (Advanced)
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {config.importMode === 'pro' ? 'Advanced mapping features enabled (constants, concatenation, etc.)' : 'Standard 1-to-1 column mapping'}
                                </p>
                            </div>
                        </div>


                        {status.message && (
                            <div className={`p-4 rounded-lg flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                                <span>{status.message}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={loading || testing}
                                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm hover:shadow"
                            >
                                {loading ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                                Save Configuration
                            </button>

                            <button
                                type="button"
                                onClick={handleTest}
                                disabled={loading || testing}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                            >
                                {testing ? <Loader className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                Test Connection
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ConnectionPage;
