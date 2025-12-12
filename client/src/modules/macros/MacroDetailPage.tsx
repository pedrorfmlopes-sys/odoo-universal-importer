import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { MacroConfig } from '../../api/models';
import { ArrowLeft, Box, ChevronRight } from 'lucide-react';

const MacroDetailPage = () => {
    const { macroId } = useParams();
    const [macro, setMacro] = useState<MacroConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.getMacros().then(macros => {
            const found = macros.find(m => m.id === macroId);
            setMacro(found || null);
        }).finally(() => setLoading(false));
    }, [macroId]);

    if (loading) return <div className="p-8 text-center text-slate-400">Loading details...</div>;
    if (!macro) return <div className="p-8 text-center text-red-500">Macro not found</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <Link to="/import" className="inline-flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium gap-1">
                <ArrowLeft size={18} /> Voltar às Macros
            </Link>

            <div className="mb-10 border-b border-slate-200 pb-6">
                <h2 className="text-3xl font-bold text-slate-800 mb-2">{macro.label}</h2>
                <p className="text-slate-500">{macro.description || "Selecione a entidade que pretende importar."}</p>
            </div>

            {macro.entities.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-400">Nenhuma entidade configurada para esta macro ainda.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {macro.entities.map(entity => (
                        <div key={entity.id} className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col hover:border-teal-500 transition-colors group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-teal-50 text-teal-600 rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                    <Box size={24} />
                                </div>
                                {entity.subgroup && (
                                    <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded">
                                        {entity.subgroup}
                                    </span>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-slate-800 mb-1">{entity.label}</h3>
                            <code className="text-xs text-slate-400 font-mono mb-6 block bg-slate-50 px-2 py-1 rounded w-fit">{entity.model}</code>

                            <Link
                                to={`/import/${macro.id}/${entity.id}`}
                                className="mt-auto flex items-center justify-between px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-teal-700 hover:border-teal-200 transition-all font-medium text-sm group-hover:shadow-sm"
                            >
                                Iniciar Importação
                                <ChevronRight size={16} />
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MacroDetailPage;
