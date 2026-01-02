
// API Client for Catalog Enricher Module

export interface CeJob {
    id: string;
    type: 'enrich' | 'update' | 'analyze';
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    params?: any;
    resultSummary?: any;
    errorText?: string;
    createdAt: string;
    updatedAt: string;
}

const MODULE_BASE = '/api/catalog-enricher';

export const ceClient = {
    async checkHealth() {
        const res = await fetch(`${MODULE_BASE}/health`);
        return res.json();
    },

    async analyzeUrl(url: string) {
        const res = await fetch(`${MODULE_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!res.ok) throw new Error('Failed to start analysis');
        return res.json() as Promise<{ success: true, jobId: string }>;
    },

    async getJobs(profileId?: string) {
        const url = profileId ?
            `${MODULE_BASE}/jobs?profileId=${profileId}` :
            `${MODULE_BASE}/jobs`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch jobs');
        return res.json() as Promise<CeJob[]>;
    },

    async getJob(id: string) {
        const res = await fetch(`${MODULE_BASE}/jobs/${id}`);
        if (!res.ok) throw new Error('Failed to fetch job');
        return res.json() as Promise<CeJob>;
    },

    async uploadFile(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${MODULE_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to upload file');
        return res.json() as Promise<{ success: true, id: string, headers: string[] }>;
    },

    async runEnrich(params: any) {
        const res = await fetch(`${MODULE_BASE}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        if (!res.ok) throw new Error('Failed to start enrichment job');
        return res.json() as Promise<{ success: true, jobId: string }>;
    },

    async getJobItems(id: string) {
        const res = await fetch(`${MODULE_BASE}/jobs/${id}/items`);
        if (!res.ok) throw new Error('Failed to fetch job items');
        return res.json() as Promise<{ items: any[] }>;
    },

    async deleteJob(jobId: string) {
        const res = await fetch(`${MODULE_BASE}/jobs/${jobId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete job'); // Added error handling for consistency
        return res.json();
    },

    // -------------------------------------------------------------------------
    // PROFILES
    // -------------------------------------------------------------------------
    async getProfiles() {
        try {
            const res = await fetch(`${MODULE_BASE}/profiles`);
            if (!res.ok) throw new Error('Failed to fetch profiles: ' + res.statusText);
            return res.json() as Promise<any[]>;
        } catch (e) {
            console.error("Critical API Error (getProfiles):", e);
            throw e;
        }
    },

    async createProfile(data: any) {
        const res = await fetch(`${MODULE_BASE}/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create profile');
        return res.json();
    },

    async updateProfile(id: string, data: any) {
        const res = await fetch(`${MODULE_BASE}/profiles/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update profile');
        return res.json();
    },

    async uploadCatalog(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${MODULE_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json() as Promise<{ success: true, id: string, filename: string, headers: string[] }>;
    },

    async deleteProfile(id: string) {
        const res = await fetch(`${MODULE_BASE}/profiles/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete profile');
        return res.json();
    },

    async detectPattern(row: any, url: string) {
        const res = await fetch(`${MODULE_BASE}/profiles/detect-pattern`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ row, url })
        });
        if (!res.ok) throw new Error('Failed to detect pattern');
        return res.json() as Promise<{ template: string, matches: string[] }>;
    },

    async testPattern(row: any, template: string) {
        const res = await fetch(`${MODULE_BASE}/profiles/test-pattern`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ row, template })
        });
        return res.json() as Promise<{ url: string }>;
    },

    // -------------------------------------------------------------------------
    // V3 CATALOG
    // -------------------------------------------------------------------------
    async getCatalogProducts(page = 1, limit = 50, search = '', brandProfileId?: string) {
        const params: any = { page: String(page), limit: String(limit), search };
        if (brandProfileId) params.brandProfileId = brandProfileId;
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${MODULE_BASE}/catalog/products?${query}`);
        if (!res.ok) throw new Error('Failed to fetch catalog');
        return res.json() as Promise<{ items: any[], total: number, page: number, totalPages: number }>;
    },

    async getCatalogCategories(brandProfileId?: string) {
        const params: any = {};
        if (brandProfileId) params.profileId = brandProfileId;
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${MODULE_BASE}/catalog/categories?${query}`);
        if (!res.ok) throw new Error('Failed to fetch categories');
        return res.json() as Promise<{ category_name: string, count: number }[]>;
    },

    async clearCatalogProducts(profileId: string) {
        const res = await fetch(`${MODULE_BASE}/catalog/products?profileId=${profileId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to clear catalog');
        return res.json();
    },

    async deleteProduct(id: number) {
        const res = await fetch(`${MODULE_BASE}/catalog/products/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete product');
        return res.json();
    },

    async updateProduct(id: number, data: { product_name: string, guessed_code: string }) {
        const res = await fetch(`${MODULE_BASE}/catalog/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update product');
        return res.json();
    },

    async exportCatalog(profileId?: string) {
        // Client-side CSV generation for immediate download
        // Iterate over pages or ask backend for full dump.
        // For simplicity/speed in V3 Beta, fetch full list limit=100000
        const query = profileId ? `?profileId=${profileId}&limit=10000` : `?limit=10000`;
        const res = await fetch(`${MODULE_BASE}/catalog/products${query}`);
        if (!res.ok) throw new Error('Failed to fetch for export');
        const data = await res.json();

        const items = data.items;
        if (items.length === 0) return alert("No items to export");

        // Convert to CSV
        const headers = ['id', 'product_name', 'guessed_code', 'category_name', 'product_url', 'image_url', 'crawled_at'];
        const csvContent = [
            headers.join(','),
            ...items.map((row: any) => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `catalog_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Crawler
    async testScrape(url: string, recipe: any) {
        const res = await fetch(`${MODULE_BASE}/crawler/test-recipe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, recipe })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Test failed');
        }
        return res.json();
    },

    async previewCrawl(url: string, selectors: any) {
        const res = await fetch(`${MODULE_BASE}/crawler/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, selectors })
        });
        if (!res.ok) throw new Error('Preview failed');
        return res.json();
    },

    async autoDetectSelectors(url: string) {
        const res = await fetch(`${MODULE_BASE}/crawler/autodetect?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Auto-detect failed');
        return res.json();
    },

    async startCrawl(url: string | string[], selectors: any, profileId?: string) {
        const res = await fetch(`${MODULE_BASE}/crawler/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, selectors, profileId })
        });
        if (!res.ok) throw new Error('Start failed');
        return res.json();
    },

    async startTeacherSession(url: string) {
        const res = await fetch(`${MODULE_BASE}/crawler/teacher/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!res.ok) throw new Error('Could not start teacher mode');
        return res.json();
    },

    async getMissingProducts(page = 1, limit = 50) {
        const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
        const res = await fetch(`${MODULE_BASE}/catalog/missing?${query}`);
        if (!res.ok) throw new Error('Failed to fetch missing products');
        return res.json() as Promise<{ items: any[], total: number, page: number, totalPages: number }>;
    },

    // -------------------------------------------------------------------------
    // JOB CONTROL
    // -------------------------------------------------------------------------
    async getActiveJobs() {
        // CHANGED: Use cache: 'no-store' instead of timestamp param to keep Network log clean
        const res = await fetch(`${MODULE_BASE}/crawler/active-jobs`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch active jobs');
        return res.json() as Promise<{ jobs: any[] }>;
    },

    async pauseQueue() {
        const res = await fetch(`${MODULE_BASE}/crawler/pause`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to pause');
        return res.json();
    },

    async resumeQueue() {
        const res = await fetch(`${MODULE_BASE}/crawler/resume`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to resume');
        return res.json();
    },

    async stopJob(jobId: string, deleteData: boolean = false) {
        const res = await fetch(`${MODULE_BASE}/crawler/jobs/${jobId}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleteData })
        });
        if (!res.ok) throw new Error('Failed to stop job');
        return res.json();
    },

    async commitJob(jobId: string) {
        const res = await fetch(`${MODULE_BASE}/crawler/jobs/${jobId}/commit`, { method: 'POST' });
        if (!res.ok) throw new Error('Commit failed');
        return res.json();
    },

    // -------------------------------------------------------------------------
    // RECIPES
    // -------------------------------------------------------------------------
    async getRecipes(domain?: string) {
        const query = domain ? `?domain=${domain}` : '';
        const res = await fetch(`${MODULE_BASE}/recipes${query}`);
        if (!res.ok) throw new Error('Failed to fetch recipes');
        return res.json() as Promise<any[]>;
    },

    async getRecipe(id: string) {
        const res = await fetch(`${MODULE_BASE}/recipes/${id}`);
        if (!res.ok) throw new Error('Failed to fetch recipe');
        return res.json() as Promise<any>;
    },

    async saveRecipe(data: { id?: string, name: string, domain: string, start_url?: string, steps: any[] }) {
        const res = await fetch(`${MODULE_BASE}/recipes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to save recipe');
        return res.json() as Promise<{ id: string }>;
    },

    async deleteRecipe(id: string) {
        const res = await fetch(`${MODULE_BASE}/recipes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete recipe');
        return res.json();
    },

    // -------------------------------------------------------------------------
    // TAXONOMY
    // -------------------------------------------------------------------------
    async getTaxonomyTree(profileId: string) {
        const res = await fetch(`${MODULE_BASE}/taxonomy/${profileId}`);
        if (!res.ok) throw new Error('Failed to fetch taxonomy');
        return res.json() as Promise<any[]>;
    },

    async addTaxonomyNode(node: any) {
        const res = await fetch(`${MODULE_BASE}/taxonomy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(node)
        });
        if (!res.ok) throw new Error('Failed to add node');
        return res.json();
    },

    async saveTaxonomyTree(profileId: string, tree: any[]) {
        const res = await fetch(`${MODULE_BASE}/taxonomy/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, tree })
        });
        if (!res.ok) throw new Error('Failed to save taxonomy tree');
        return res.json();
    },

    async scanStructure(url: string, domain: string, deep = false) {
        const res = await fetch(`${MODULE_BASE}/crawler/scan-structure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, domain, deep })
        });
        if (!res.ok) throw new Error('Failed to scan structure');
        return res.json() as Promise<{ tree: any[] }>;
    },

    async clearTaxonomy(profileId: string) {
        const res = await fetch(`${MODULE_BASE}/taxonomy/${profileId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to clear taxonomy');
        return res.json();
    },

    async startBulkCrawl(profileId: string, recipeId: string, urls: string[]) {
        const res = await fetch(`${MODULE_BASE}/crawler/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, recipeId, urls })
        });
        if (!res.ok) throw new Error('Failed to start bulk crawl');
        return res.json() as Promise<{ success: true, jobId: string }>;
    },

    // -------------------------------------------------------------------------
    // CREDENTIALS
    // -------------------------------------------------------------------------
    async getCredentials() {
        const res = await fetch(`${MODULE_BASE}/credentials`);
        if (!res.ok) throw new Error('Failed to fetch credentials');
        return res.json() as Promise<any[]>;
    },

    async createCredential(data: any) {
        const res = await fetch(`${MODULE_BASE}/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create credential');
        return res.json();
    },

    async updateCredential(id: string, data: any) {
        const res = await fetch(`${MODULE_BASE}/credentials/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update credential');
        return res.json();
    },

    async deleteCredential(id: string) {
        const res = await fetch(`${MODULE_BASE}/credentials/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete credential');
        return res.json();
    },

    async revealCredential(id: string) {
        const res = await fetch(`${MODULE_BASE}/credentials/${id}/reveal`);
        if (!res.ok) throw new Error('Failed to reveal password');
        return res.json() as Promise<{ password: string }>;
    },

    async triggerAssetDownload(brandProfileId: string, assetTypes?: string[]) {
        const res = await fetch(`${MODULE_BASE}/assets/download-missing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandProfileId, assetTypes })
        });
        if (!res.ok) throw new Error('Failed to start asset download');
        return res.json() as Promise<{ success: boolean, message: string }>;
    },

    // -------------------------------------------------------------------------
    // GENERIC HELPERS (Exposed for new modules)
    // -------------------------------------------------------------------------
    async get(path: string) {
        const res = await fetch(`${MODULE_BASE}${path}`);
        if (!res.ok) throw new Error(`GET ${path} failed`);
        return res.json();
    },

    async post(path: string, body: any) {
        const isFormData = body instanceof FormData;
        const opts: RequestInit = {
            method: 'POST',
            body: isFormData ? body : JSON.stringify(body)
        };
        if (!isFormData) opts.headers = { 'Content-Type': 'application/json' };

        const res = await fetch(`${MODULE_BASE}${path}`, opts);
        if (!res.ok) throw new Error(`POST ${path} failed`);
        return res.json();
    },

    async delete(path: string) {
        const res = await fetch(`${MODULE_BASE}${path}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE ${path} failed`);
        return res.json();
    }
};
