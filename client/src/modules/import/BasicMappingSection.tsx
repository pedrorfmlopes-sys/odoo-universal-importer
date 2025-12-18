
import React from 'react';
import { OdooFieldMeta } from '../../api/apiClient';

interface BasicMappingSectionProps {
    displayFields: OdooFieldMeta[];
    columns: string[];
    mapping: Record<string, string>;
    onChange: (field: string, value: string) => void;
}

export const BasicMappingSection: React.FC<BasicMappingSectionProps> = ({
    displayFields,
    columns,
    mapping,
    onChange
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <div className="col-span-5">Odoo Field</div>
                <div className="col-span-2 text-center">Type</div>
                <div className="col-span-5">Excel Column</div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
                {displayFields.map(field => (
                    <div key={field.name} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors">
                        <div className="col-span-5">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-slate-800">
                                        {field.string}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        ({field.name})
                                    </span>
                                </div>

                                {((field.hint && field.hint.trim()) || (field.help && field.help.trim())) && (
                                    <p className="mt-1 text-xs text-slate-500 leading-snug">
                                        {(field.hint && field.hint.trim()) || (field.help && field.help.trim())}
                                    </p>
                                )}
                            </div>
                        </div>


                        <div className="col-span-2 text-center text-xs">
                            <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">{field.type}</span>
                        </div>
                        <div className="col-span-5">
                            <select
                                value={mapping[field.name] || ''}
                                onChange={(e) => onChange(field.name, e.target.value)}
                                disabled={field.type === 'many2one'}
                                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500 transition-all ${mapping[field.name] ? 'border-teal-500 bg-teal-50/30' : 'border-slate-300'} ${field.type === 'many2one' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                            >
                                <option value="">{field.type === 'many2one' ? '(Use PRO Mode)' : '-- Ignore --'}</option>
                                {columns.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
