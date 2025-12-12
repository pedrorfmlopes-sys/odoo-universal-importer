import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout = () => {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 bg-slate-50 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
