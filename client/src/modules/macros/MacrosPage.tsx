import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { MacroConfig } from '../../api/models';
import { Layers, Briefcase, ShoppingCart, Wrench, FileText, Users } from 'lucide-react';

const MacrosPage = () => {
    const [macros, setMacros] = useState<MacroConfig[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.getMacros()
            .then(setMacros)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const getIcon = (id: string) => {
        switch (id) {
            case 'commercial': return <Users size={32} />;
            case 'sales_crm': return <Briefcase size={32} />;
            case 'purchasing_inventory': return <ShoppingCart size={32} />;
            case 'projects_services': return <Wrench size={32} />;
            case 'accounting': return <FileText size={32} />;
            case 'hr': return <Users size={32} />; // Duplicate icon but okay for now
            default: return <Layers size={32} />;
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading macros...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Selecione a Área de Negócio</h2>
            <p className="text-slate-500 mb-8">Escolha a macro-categoria para ver as entidades disponíveis para importação.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {macros.map((macro) => (
                    <div key={macro.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow flex flex-col items-start">
                        <div className="p-3 bg-slate-100 rounded-lg text-slate-700 mb-4">
                            {getIcon(macro.id)}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{macro.label}</h3>
                        <p className="text-slate-500 text-sm mb-6 flex-1">{macro.description || "Gestão e importação de dados para esta área."}</p>

                        <Link
                            to={`/import/${macro.id}`}
                            className="w-full text-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                        >
                            Explorar Entidades
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MacrosPage;
