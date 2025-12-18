
import React from 'react';
import { OdooFieldMeta, ImportMapping, FieldMapping, FieldMappingMode } from '../../api/apiClient';
import { Type, List } from 'lucide-react';


interface ProMappingSectionProps {
    displayFields: OdooFieldMeta[];
    columns: string[];
    mapping: ImportMapping;
    onChange: (field: string, value: FieldMapping) => void;
}

// Hardcoded configuration for UI known relational fields
const RELATIONAL_FIELDS_UI: Record<string, Record<string, { relatedModel: string; displayField: string; createIfNotFound: boolean }>> = {
    "product.template": {
        uom_id: { relatedModel: "uom.uom", displayField: "name", createIfNotFound: false },
        uom_po_id: { relatedModel: "uom.uom", displayField: "name", createIfNotFound: false },
        categ_id: { relatedModel: "product.category", displayField: "name", createIfNotFound: true },
    },
};

import { apiClient, RelationalOption } from '../../api/apiClient';

export const ProMappingSection: React.FC<ProMappingSectionProps> = ({
    displayFields,
    columns,
    mapping,
    onChange
}) => {
    // We need to know current model to check config. 
    // Assuming displayFields come from a single model context, we can pick the first one's model? 
    // OR we should pass `modelName` as prop.
    // Since we don't have modelName prop yet, let's try to infer or ask user to pass it.
    // But wait, the parent ImportWizardPage has `model`.
    // Let's assume we are consistently working on "product.template" for now or check if we can pass it.
    // I will add a prop `modelName` to ProMappingSectionProps in previous step or here?
    // I'll stick to hardcoded check on field names for now OR just assume the prop is passed (I need to update parent).
    // Let's rely on field names matching the config keys if we can't get model name easily.
    // BETTER: Update the component to accept `modelName`.

    // Actually, looking at previous context, `ImportWizardPage` renders this. I should update props.
    // For now, I'll assume we received `modelName` or I can infer it from the context if I had it.
    // Let's just try to match field names against known ones if they are unique enough (they are).
    // But `uom_id` exists on many models.
    // Correct fix: Add modelName prop. For this step I will assume "product.template" if I see specific fields or add the prop.

    // Adding modelName prop inside the component definition below.
    // NOTE: The user instruction implies we should support these fields.

    const [relationalOptions, setRelationalOptions] = React.useState<Record<string, RelationalOption[]>>({});
    const [loadingOptions, setLoadingOptions] = React.useState<Record<string, boolean>>({});

    const handleModeChange = (field: string, mode: FieldMappingMode) => {
        let newMapping: FieldMapping = { mode };
        // Pre-fill defaults
        if (mode === 'column') newMapping.column = columns[0] || '';
        if (mode === 'constant') newMapping.constantValue = '';
        if (mode === 'concat') { newMapping.columns = []; newMapping.separator = ' '; }
        if (mode === 'booleanConstant') newMapping.booleanValue = true;

        // Relational defaults
        // We need to look up config
        const modelName = "product.template"; // TODO: Pass as prop
        const relConfig = RELATIONAL_FIELDS_UI[modelName]?.[field];

        if (relConfig && (mode.startsWith('relational'))) {
            newMapping.relational = {
                mainModel: modelName,
                relatedModel: relConfig.relatedModel,
                displayField: relConfig.displayField,
                createIfNotFound: relConfig.createIfNotFound
            };

            if (mode === 'relationalFromColumn') {
                newMapping.column = columns[0] || '';
            }
            if (mode === 'relationalConstantNew') {
                newMapping.constantValue = '';
            }
            // For relationalConstantExisting we wait for user selection
        }

        onChange(field, newMapping);
    };

    const updateMapping = (field: string, updates: Partial<FieldMapping>) => {
        const current = mapping[field] || { mode: 'column' };
        onChange(field, { ...current, ...updates });
    };

    const loadOptions = async (field: string) => {
        const modelName = "product.template"; // TODO: Pass as prop
        if (loadingOptions[field] || relationalOptions[field]) return;

        setLoadingOptions(prev => ({ ...prev, [field]: true }));
        try {
            const items = await apiClient.fetchRelationalOptions(modelName, field);
            setRelationalOptions(prev => ({ ...prev, [field]: items }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingOptions(prev => ({ ...prev, [field]: false }));
        }
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
                    const isBoolean = field.type === 'boolean';

                    const modelName = "product.template"; // TODO
                    const relConfig = RELATIONAL_FIELDS_UI[modelName]?.[field.name];
                    const isRelational = !!relConfig;

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
                                    }}
                                >
                                    <option value="">-- Ignore --</option>
                                    <option value="column">Excel Column</option>
                                    <option value="constant">Constant Value</option>
                                    <option value="concat">Concatenate</option>
                                    {isBoolean && <option value="booleanConstant">Yes/No (Boolean)</option>}
                                    {isRelational && (
                                        <>
                                            <option disabled>──────────</option>
                                            <option value="relationalConstantExisting">Pick Existing (Odoo)</option>
                                            <option value="relationalFromColumn">Search by Name (Column)</option>
                                            {relConfig.createIfNotFound && <option value="relationalConstantNew">Create New (Constant)</option>}
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Configuration */}
                            <div className="col-span-5">
                                {!fieldMapping ? (
                                    <div className="text-xs text-slate-400 italic py-2">Not mapped</div>
                                ) : (
                                    <>
                                        {/* STANDARD MODES */}
                                        {(fieldMapping.mode === 'column' || fieldMapping.mode === 'relationalFromColumn') && (
                                            <div className="flex flex-col gap-1">
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
                                                {fieldMapping.mode === 'relationalFromColumn' && (
                                                    <div className="text-[10px] text-slate-500 pl-6">
                                                        Values will be matched against <b>{relConfig?.relatedModel}</b>.
                                                        {relConfig?.createIfNotFound ? " Created if missing." : " Must exist."}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {(fieldMapping.mode === 'constant' || fieldMapping.mode === 'relationalConstantNew') && (
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

                                        {fieldMapping.mode === 'relationalConstantExisting' && (
                                            <div className="flex items-center gap-2">
                                                <List size={16} className="text-slate-400" />
                                                <select
                                                    value={fieldMapping.relational?.fixedId || ''}
                                                    onFocus={() => loadOptions(field.name)}
                                                    onChange={(e) => {
                                                        const id = Number(e.target.value);
                                                        const opt = relationalOptions[field.name]?.find(o => o.id === id);
                                                        if (opt) {
                                                            updateMapping(field.name, {
                                                                relational: {
                                                                    ...fieldMapping.relational!, // preserve config
                                                                    fixedId: id
                                                                }
                                                            });
                                                        }
                                                    }}
                                                    className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500 border-slate-300"
                                                >
                                                    <option value="">Select {relConfig?.relatedModel}...</option>
                                                    {loadingOptions[field.name] && <option disabled>Loading...</option>}
                                                    {relationalOptions[field.name]?.map(opt => (
                                                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                                                    ))}
                                                </select>
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
