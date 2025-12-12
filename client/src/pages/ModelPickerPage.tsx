import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, OdooModel } from '../api/apiClient';
import { Box, Users, ArrowRight, Database, Loader } from 'lucide-react';

const ModelPickerPage = () => {
    const [models, setModels] = useState<OdooModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadModels();
    }, []);

    const loadModels = async () => {
        try {
            const data = await apiClient.getModels();
            setModels(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load models');
        } finally {
            setLoading(false);
        }
    };

    // Helper to pick an icon based on model id
    const getIcon = (id: string) => {
        switch (id) {
            case 'products': return <Box size={32} />;
            case 'customers': return <Users size={32} />;
            default: return <Database size={32} />;
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center text-slate-500 gap-3">
                <Loader className="animate-spin" size={24} />
                <span>Loading available models...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200">
                    <h3 className="font-bold mb-2">Error loading models</h3>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white border border-red-300 rounded text-sm hover:bg-red-50">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Start New Import</h2>
                <p className="text-slate-500 mt-1">Select the type of data you want to upload to Odoo.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {models.map((m) => (
                    <Link
                        key={m.id}
                        to={`/import/${m.id}`}
                        className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                        <div>
                            <div className="text-teal-600 mb-5 p-3 bg-teal-50 rounded-lg w-fit group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300">
                                {getIcon(m.id)}
                            </div>
                            <h3 className="font-bold text-lg text-slate-800 group-hover:text-teal-700 transition-colors">{m.label}</h3>
                            <code className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded mt-2 inline-block font-mono border border-slate-200">
                                {m.model}
                            </code>
                        </div>

                        <div className="mt-6 flex items-center text-teal-600 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                            Start Import <ArrowRight size={16} className="ml-1" />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default ModelPickerPage;
