import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Import, Database, Sparkles } from 'lucide-react';

const Sidebar = () => {
    const location = useLocation();

    const menuItems = [
        { path: '/', label: 'Dashboard', Icon: LayoutDashboard },
        { path: '/import', label: 'Importar', Icon: Import },
        { path: '/catalog-enricher', label: 'Catálogo', Icon: Sparkles },
        { path: '/connection', label: 'Configuração', Icon: Database },
    ];

    return (
        <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                    Odoo Importer
                </h1>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                ? 'bg-teal-600/20 text-teal-300 border border-teal-600/30'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <item.Icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
                v1.1.0 Beta
            </div>
        </aside>
    );
};

export default Sidebar;
