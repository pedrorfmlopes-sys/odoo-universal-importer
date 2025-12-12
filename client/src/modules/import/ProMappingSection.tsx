
import React from 'react';
import { OdooFieldMeta, ImportMapping, FieldMapping, FieldMappingMode } from '../../api/apiClient';
import { Type, List } from 'lucide-react';


interface ProMappingSectionProps {
    displayFields: OdooFieldMeta[];
    columns: string[];
    mapping: ImportMapping;
    onChange: (field: string, value: FieldMapping) => void;
}

export const ProMappingSection: React.FC<ProMappingSectionProps> = ({
    displayFields,
    columns,
    mapping,
    onChange
}) => {

    const handleModeChange = (field: string, mode: FieldMappingMode) => {
        let newMapping: FieldMapping = { mode };
        // Pre-fill defaults to avoid nulls
        if (mode === 'column') newMapping.column = columns[0] || '';
        if (mode === 'constant') newMapping.constantValue = '';
        if (mode === 'concat') { newMapping.columns = []; newMapping.separator = ' '; }
        if (mode === 'booleanConstant') newMapping.booleanValue = true;

        onChange(field, newMapping);
    };

    const updateMapping = (field: string, updates: Partial<FieldMapping>) => {
        const current = mapping[field] || { mode: 'column' };
        onChange(field, { ...current, ...updates });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <div className="col-span-4">Odoo Field</div>
                <div className="col-span-3 text-center">Source Mode</div>
                <div className="col-span-5">Configuration</div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                {displayFields.map(field => {
                    const fieldMapping = mapping[field.name];


                    // Check if field is boolean for booleanConstant option
                    const isBoolean = field.type === 'boolean';

                    return (
                        <div key={field.name} className="grid grid-cols-12 gap-4 p-4 items-start hover:bg-slate-50 transition-colors">
                            <div className="col-span-4">
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
                                <div className="mt-1"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600 border border-slate-200">{field.type}</span></div>
                            </div>


                            {/* Mode Selector */}
                            <div className="col-span-3 flex flex-col gap-2">
                                <select
                                    className="text-sm border border-slate-300 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                    value={fieldMapping?.mode || ''}
                                    onChange={(e) => {
                                        if (e.target.value) handleModeChange(field.name, e.target.value as FieldMappingMode);
                                        else {
                                            // Handle clearing?
                                            // For now just unset
                                            // Actually I can't unset easily with the current type without deleting the key from parent. 
                                            // Let's assume selecting "" does nothing or we need a delete handler. 
                                            // But standard UI is "Ignore" by default if not in mapping.
                                            // So if value is empty string, we can maybe treat as unmapped? 
                                            // The prop expects FieldMapping. Parent handles "unmapped" by not having key.
                                            // I'll make parent handle undefined? No, type is strict.
                                            // I'll assume users select a mode to map. To unmap they might need a clear button.
                                            // Or simplified: Just "column" mode with empty column = ignore.
                                        }
                                    }}
                                >
                                    <option value="">-- Ignore --</option>
                                    <option value="column">Excel Column</option>
                                    <option value="constant">Constant Value</option>
                                    <option value="concat">Concatenate</option>
                                    {isBoolean && <option value="booleanConstant">Yes/No (Boolean)</option>}
                                </select>
                            </div>

                            {/* Configuration */}
                            <div className="col-span-5">
                                {!fieldMapping ? (
                                    <div className="text-xs text-slate-400 italic py-2">Not mapped</div>
                                ) : (
                                    <>
                                        {fieldMapping.mode === 'column' && (
                                            <div className="flex items-center gap-2">
                                                <List size={16} className="text-slate-400" />
                                                <select
                                                    value={fieldMapping.column || ''}
                                                    onChange={(e) => updateMapping(field.name, { column: e.target.value })}
                                                    className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500 border-slate-300"
                                                >
                                                    <option value="">Select Column...</option>
                                                    {columns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {fieldMapping.mode === 'constant' && (
                                            <div className="flex items-center gap-2">
                                                <Type size={16} className="text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={fieldMapping.constantValue || ''}
                                                    onChange={(e) => updateMapping(field.name, { constantValue: e.target.value })}
                                                    placeholder="Enter fixed value"
                                                    className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500 border-slate-300"
                                                />
                                            </div>
                                        )}

                                        {fieldMapping.mode === 'booleanConstant' && (
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateMapping(field.name, { booleanValue: true })}
                                                    className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium border ${fieldMapping.booleanValue === true ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-white border-slate-300 text-slate-600'}`}
                                                >
                                                    True / Yes
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateMapping(field.name, { booleanValue: false })}
                                                    className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium border ${fieldMapping.booleanValue === false ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-300 text-slate-600'}`}
                                                >
                                                    False / No
                                                </button>
                                            </div>
                                        )}

                                        {fieldMapping.mode === 'concat' && (
                                            <div className="space-y-2">
                                                <div className="text-xs text-slate-500 font-medium">Columns to join:</div>
                                                <div className="border border-slate-300 rounded-lg p-2 max-h-32 overflow-y-auto bg-white">
                                                    {columns.map(col => (
                                                        <label key={col} className="flex items-center gap-2 py-1 px-1 hover:bg-slate-50 rounded cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={(fieldMapping.columns || []).includes(col)}
                                                                onChange={(e) => {
                                                                    const currentCols = fieldMapping.columns || [];
                                                                    let newCols;
                                                                    if (e.target.checked) newCols = [...currentCols, col];
                                                                    else newCols = currentCols.filter(c => c !== col);
                                                                    updateMapping(field.name, { columns: newCols });
                                                                }}
                                                                className="rounded text-teal-600 focus:ring-teal-500"
                                                            />
                                                            <span className="text-sm text-slate-700">{col}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500">Separator:</span>
                                                    <input
                                                        type="text"
                                                        value={fieldMapping.separator || ''}
                                                        onChange={(e) => updateMapping(field.name, { separator: e.target.value })}
                                                        placeholder="e.g. ' - ' or space"
                                                        className="flex-1 text-sm border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-teal-500 border-slate-300"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
