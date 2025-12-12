export interface OdooConfig {
    url: string;
    db: string;
    userEmail: string;
    apiKey: string;
    importMode?: 'basic' | 'pro';
}


export interface OdooModel {
    id: string;
    label: string;
    model: string;
}

// Local interfaces for API response wrapping
export interface ApiResponse<T = any> {
    success?: boolean;
    message?: string;
    data?: T;
    error?: string;
}

import { MacroConfig, OdooFieldMeta, ImportDryRunResult, ImportRunResult, FieldMappingMode, FieldMapping, ImportMapping } from './models';
export type { MacroConfig, OdooFieldMeta, ImportDryRunResult, ImportRunResult, FieldMappingMode, FieldMapping, ImportMapping };





export interface ParsedSheet {
    name: string;
    columns: string[];
    rowCount: number;
    rows: any[];
    previewRows: any[];
}

export interface ParsedWorkbook {
    sheets: ParsedSheet[];
    defaultSheet: string | null;
}

const API_BASE = '/api';

export const apiClient = {
    async getOdooConfig(): Promise<OdooConfig | null> {
        const res = await fetch(`${API_BASE}/config`);
        if (!res.ok) throw new Error('Failed to fetch config');
        return res.json();
    },

    async getMacros(): Promise<MacroConfig[]> {
        const res = await fetch(`${API_BASE}/macros`);
        if (!res.ok) throw new Error('Failed to fetch macros');
        return res.json();
    },


    async saveOdooConfig(config: OdooConfig): Promise<ApiResponse> {
        const res = await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to save config');
        }
        return res.json();
    },

    async testOdooConfig(): Promise<ApiResponse> {
        const res = await fetch(`${API_BASE}/config/test`, {
            method: 'POST'
        });

        try {
            return await res.json();
        } catch (err) {
            // Frontend fix: Handle empty or non-JSON responses gracefully
            return {
                success: false,
                message: res.statusText || 'Unknown error occurred (Invalid JSON response)'
            };
        }
    },

    async getModels(): Promise<OdooModel[]> {
        const res = await fetch(`${API_BASE}/models`);
        if (!res.ok) throw new Error('Failed to fetch models');
        return res.json();
    },

    async uploadExcel(file: File): Promise<ParsedWorkbook> {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/upload-excel`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('Failed to upload file');
        return res.json();
    },


    async getFields(model: string): Promise<OdooFieldMeta[]> {
        const res = await fetch(`${API_BASE}/fields?model=${model}`);
        if (!res.ok) throw new Error('Failed to fetch fields');
        const data = await res.json();
        return data.items || data;
    },


    async dryRunImport(payload: any): Promise<ImportDryRunResult> {
        const res = await fetch(`${API_BASE}/import/dry-run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Dry run failed');
        return res.json();
    },

    async runImport(payload: any): Promise<ImportRunResult> {
        const res = await fetch(`${API_BASE}/import/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Import failed');
        return res.json();
    }
};



