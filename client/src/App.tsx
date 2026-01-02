import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import DashboardPage from './pages/DashboardPage';
import ConnectionPage from './pages/ConnectionPage';
import MacrosPage from './modules/macros/MacrosPage';
import MacroDetailPage from './modules/macros/MacroDetailPage';
import ImportWizardPage from './pages/ImportWizardPage';

import CeDashboardPage from './modules/catalogEnricher/pages/CeDashboardPage';
import CeRecipePage from './modules/catalogEnricher/pages/CeRecipePage';
import CeDossiersPage from './modules/catalogEnricher/pages/CeDossiersPage';
import CeDossierDetailPage from './modules/catalogEnricher/pages/CeDossierDetailPage';
import { CeCatalogPage } from './modules/catalogEnricher/pages/CeCatalogPage';
import { CeCrawlerPage } from './modules/catalogEnricher/pages/CeCrawlerPage';
import { CeImportWizardPage } from './modules/catalogEnricher/pages/CeImportWizardPage';
import { CeJobReportPage } from './modules/catalogEnricher/pages/CeJobReportPage';
import { CeMergerPage } from './modules/catalogEnricher/pages/CeMergerPage';


function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="connection" element={<ConnectionPage />} />

                    {/* Catalog Enricher Module Routes */}
                    <Route path="catalog-enricher" element={<CeDashboardPage />} />
                    <Route path="catalog-enricher/recipes" element={<CeRecipePage />} />

                    <Route path="catalog-enricher/dossiers" element={<CeDossiersPage />} />
                    <Route path="catalog-enricher/dossiers/:id" element={<CeDossierDetailPage />} />
                    <Route path="catalog-enricher/catalog" element={<CeCatalogPage />} />

                    <Route path="catalog-enricher/crawler" element={<CeCrawlerPage />} />
                    <Route path="catalog-enricher/wizard" element={<CeImportWizardPage />} />
                    <Route path="catalog-enricher/report/:jobId" element={<CeJobReportPage />} />
                    <Route path="catalog-enricher/merger" element={<CeMergerPage />} />

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
