import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import DashboardPage from './pages/DashboardPage';
import ConnectionPage from './pages/ConnectionPage';
import MacrosPage from './modules/macros/MacrosPage';
import MacroDetailPage from './modules/macros/MacroDetailPage';
import ImportWizardPage from './pages/ImportWizardPage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="connection" element={<ConnectionPage />} />

                    <Route path="import" element={<MacrosPage />} />
                    <Route path="import/:macroId" element={<MacroDetailPage />} />
                    <Route path="import/:macroId/:entityId" element={<ImportWizardPage />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
