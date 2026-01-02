import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { CeJobMonitor } from '../modules/catalogEnricher/components/CeJobMonitor';

const MainLayout = () => {
    return (
        <div className="flex min-h-screen relative">
            <CeJobMonitor />
            <Sidebar />
            <main className="flex-1 bg-slate-50 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
