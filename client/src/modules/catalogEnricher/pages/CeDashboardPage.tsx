
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ceClient } from '../api/ceClient';
import { Plus, Folder, Database, Bot, ArrowLeft } from 'lucide-react';

const CeDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ profiles: 0, jobs: 0 });

    useEffect(() => {
        (async () => {
            try {
                const profiles = await ceClient.getProfiles();
                // Simple assumption: we can count jobs later properly
                // For now just show profile count
                setStats({ profiles: profiles.length, jobs: 0 });
            } catch (e) { console.error(e); }
        })();
    }, []);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" title="Back to Main Menu">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Catalog Enricher</h1>
                        <p className="text-slate-500 mt-1">Manage brand profiles, data extraction, and product catalogs.</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/catalog-enricher/dossiers')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-purple-200 flex items-center gap-2 font-bold transition-transform hover:scale-105 active:scale-95"
                >
                    <Plus size={20} /> New Import Job
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    onClick={() => navigate('/catalog-enricher/dossiers')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                        <Folder size={24} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">My Dossiers</h3>
                    <p className="text-slate-500 text-sm">Manage configuration profiles for different brands and websites.</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Profiles</span>
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">{stats.profiles}</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/catalog-enricher/catalog')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                        <Database size={24} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Web Catalog</h3>
                    <p className="text-slate-500 text-sm">Explore extracted products, verify data health, and manage missing items.</p>
                </div>

                <div
                    onClick={() => navigate('/catalog-enricher/crawler')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                        <Bot size={24} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2 flex items-center gap-2">
                        Universal Robot <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-wider">New</span>
                    </h3>
                    <p className="text-slate-500 text-sm">Configure AI extraction agents for any website. Auto-discovery included.</p>
                </div>

                <div
                    onClick={() => navigate('/catalog-enricher/merger')}
                    className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-lg shadow-blue-200 text-white hover:shadow-xl transition-all cursor-pointer group transform hover:-translate-y-1"
                >
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white mb-4 backdrop-blur-sm group-hover:scale-110 transition-transform">
                        <Database size={24} />
                    </div>
                    <h3 className="font-bold text-white text-lg mb-2">Pricelist Merger</h3>
                    <p className="text-blue-100 text-sm">Match Excel pricelists with web data. Now with Targeted SKU Enrichment.</p>
                </div>
            </div>
        </div>
    );
};

export default CeDashboardPage;
