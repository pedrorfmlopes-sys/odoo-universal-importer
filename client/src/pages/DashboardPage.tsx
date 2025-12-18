import { useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';

const DashboardPage = () => {
    const [status, setStatus] = useState<{ label: string, color: string }>({ label: 'Checking...', color: 'bg-yellow-400' });

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await apiClient.testOdooConfig();
            if (res.success) {
                setStatus({ label: 'Connected', color: 'bg-green-500' });
            } else {
                // If message says "No config", we can show that
                if (res.message === 'No config saved') {
                    setStatus({ label: 'Not Configured', color: 'bg-slate-400' });
                } else {
                    setStatus({ label: 'Connection Failed', color: 'bg-red-500' });
                }
            }
        } catch (err) {
            setStatus({ label: 'Error', color: 'bg-red-500' });
        }
    };

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-gray-500 text-sm font-medium">Recent Imports</h3>
                    <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-gray-500 text-sm font-medium">Connection Status</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                        <span className="font-semibold text-slate-700">{status.label}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
