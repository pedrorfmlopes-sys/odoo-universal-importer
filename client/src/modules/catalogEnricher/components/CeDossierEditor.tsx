import { useState, useEffect } from 'react';
import { ceClient } from '../api/ceClient';
import { X, Wand2, Check, Save, TestTube, Image as ImageIcon, FileText, Box, Layout } from 'lucide-react';

interface Props {
    profile?: any;
    onClose: () => void;
    onSaved: () => void;
}

type TargetType = 'web' | 'image' | 'pdf' | 'cad';

interface PatternData {
    template: string;
    matches: string[];
    exampleUrl: string;
}

const CeDossierEditor = ({ profile, onClose, onSaved }: Props) => {
    const [name, setName] = useState('');
    const [urlRoot, setUrlRoot] = useState('');

    const [authRequired, setAuthRequired] = useState(false);
    const [credentialId, setCredentialId] = useState(''); // New ID selection
    const [availableCreds, setAvailableCreds] = useState<any[]>([]); // List

    // Editor State
    const [activeType, setActiveType] = useState<TargetType>('web');
    const [patterns, setPatterns] = useState<Record<string, PatternData>>({});

    // Teach Logic
    const [sampleRef, setSampleRef] = useState('');
    const [sampleName, setSampleName] = useState('');

    // Current Input State (synced with activeType)
    const [currentExampleUrl, setCurrentExampleUrl] = useState('');
    const [currentDetected, setCurrentDetected] = useState<{ template: string, matches: string[] } | null>(null);

    // Advanced Mode State
    const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
    const [jsonConfig, setJsonConfig] = useState('');

    const [isDetecting, setIsDetecting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initial Load
    useEffect(() => {
        if (profile) {
            setName(profile.name);
            setUrlRoot(profile.domain_root || '');
            setAuthRequired(!!profile.auth_required);
            setCredentialId(profile.credential_id || ''); // Load saved ID

            // Load Patterns
            let loadedPatterns: Record<string, PatternData> = {};

            if (profile.extraction_rules_json) {
                setJsonConfig(JSON.stringify(JSON.parse(profile.extraction_rules_json), null, 2));
                try {
                    const rules = JSON.parse(profile.extraction_rules_json);
                    if (rules.patterns) {
                        loadedPatterns = rules.patterns;
                    } else if (rules.targets) {
                        // V2 format: convert back to simple patterns for UI if possible
                        Object.entries(rules.targets).forEach(([key, val]: any) => {
                            if (val.strategy === 'pattern' || val.template) {
                                // Map target keys to UI types if possible
                                let type = 'web';
                                if (key.includes('image')) type = 'image';
                                else if (key.includes('pdf')) type = 'pdf';
                                else if (key.includes('cad')) type = 'cad';

                                loadedPatterns[type] = {
                                    template: val.template,
                                    matches: val._meta?.matches || [],
                                    exampleUrl: val._meta?.exampleUrl || ''
                                };
                            }
                        });
                    } else if (profile.url_pattern_template) {
                        // Migration: Old single format
                        const type = rules.targetType || 'web';
                        loadedPatterns[type] = {
                            template: profile.url_pattern_template,
                            matches: ['Loaded from legacy profile'],
                            exampleUrl: ''
                        };
                    }
                } catch { }
            } else if (profile.url_pattern_template) {
                // Fallback if no rules JSON
                loadedPatterns['web'] = {
                    template: profile.url_pattern_template,
                    matches: ['Loaded from legacy profile'],
                    exampleUrl: ''
                };
            }
            setPatterns(loadedPatterns);
        }

        // Load credentials list
        ceClient.getCredentials().then(setAvailableCreds).catch(console.error);
    }, [profile]);


    // Sync input fields when switching types
    useEffect(() => {
        const saved = patterns[activeType];
        if (saved) {
            setCurrentExampleUrl(saved.exampleUrl || '');
            setCurrentDetected({ template: saved.template, matches: saved.matches });
        } else {
            setCurrentExampleUrl('');
            setCurrentDetected(null);
        }
    }, [activeType, patterns]);

    const handleDetect = async () => {
        if (!sampleRef || !currentExampleUrl) return;
        setIsDetecting(true);
        try {
            // Construct pseudo-row
            const row = { ItemCode: sampleRef, Name: sampleName };
            const res = await ceClient.detectPattern(row, currentExampleUrl);

            const newPattern: PatternData = {
                template: res.template,
                matches: res.matches,
                exampleUrl: currentExampleUrl
            };

            setCurrentDetected(res);
            setPatterns(prev => ({
                ...prev,
                [activeType]: newPattern
            }));

        } catch (err: any) {
            console.error(err);
            alert('Failed to detect pattern: ' + err.message);
        } finally {
            setIsDetecting(false);
        }
    };

    const handleSave = async () => {
        if (!name) return;
        setIsSaving(true);
        try {
            // Determine primary pattern for legacy column (prefer web, then pdf, etc)
            const primary = patterns['web'] || patterns['pdf'] || patterns['image'] || patterns['cad'];
            const legacyTemplate = primary ? primary.template : '';

            let finalRulesJson = '';

            if (mode === 'advanced') {
                // Validate JSON
                try {
                    JSON.parse(jsonConfig);
                    finalRulesJson = jsonConfig;
                } catch (e) {
                    alert('Invalid JSON in Advanced Configuration');
                    setIsSaving(false);
                    return;
                }
            } else {
                // Build V2 Structure from Visual Editor
                finalRulesJson = JSON.stringify({
                    version: 2,
                    targets: Object.entries(patterns).reduce((acc, [k, v]) => ({
                        ...acc,
                        [k]: {
                            strategy: 'pattern',
                            template: v.template,
                            _meta: { exampleUrl: v.exampleUrl, matches: v.matches }
                        }
                    }), {})
                });
            }

            const payload = {
                name,
                domain_root: urlRoot,
                auth_required: authRequired,
                credential_id: credentialId, // Save ID
                url_pattern_template: legacyTemplate,
                extraction_rules_json: finalRulesJson
            };

            if (profile) {
                await ceClient.updateProfile(profile.id, payload);
            } else {
                await ceClient.createProfile(payload);
            }
            onSaved();
        } catch (err) {
            console.error(err);
            alert('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const getTypeButtonClass = (type: TargetType) => {
        const isActive = activeType === type;

        let base = "relative p-3 rounded-lg border flex flex-col items-center gap-2 text-xs font-medium transition-all ";

        if (isActive) {
            if (type === 'web') base += "bg-purple-100 border-purple-500 text-purple-700";
            if (type === 'image') base += "bg-blue-100 border-blue-500 text-blue-700";
            if (type === 'pdf') base += "bg-red-100 border-red-500 text-red-700";
            if (type === 'cad') base += "bg-orange-100 border-orange-500 text-orange-700";
        } else {
            base += "bg-white border-slate-200 text-slate-600 hover:border-slate-300";
        }

        return base;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{profile ? 'Edit Brand Dossier' : 'New Brand Dossier'}</h2>
                        <p className="text-xs text-slate-500">Configure reusable profiles for this supplier.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        title="Close"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8">

                    {/* Basic Info */}
                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Brand / Supplier Name</span>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Example Brand Inc."
                                className="mt-1 w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Website Root URL</span>
                            <input
                                type="text"
                                value={urlRoot}
                                onChange={e => setUrlRoot(e.target.value)}
                                placeholder="https://example.com"
                                className="mt-1 w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                            />
                        </label>
                        <label className="flex items-center gap-2 pt-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={authRequired}
                                onChange={e => setAuthRequired(e.target.checked)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                            />
                            <span className="text-sm text-slate-600 select-none">This site requires login (B2B)</span>
                            <span className="text-sm text-slate-600 select-none">This site requires login (B2B)</span>
                        </label>

                        {authRequired && (
                            <div className="pl-6 pt-2 animate-in slide-in-from-top-2">
                                <label htmlFor="credentialSelect" className="block text-sm font-medium text-slate-700 mb-1">Select Credential Profile</label>
                                <select
                                    id="credentialSelect"
                                    value={credentialId}
                                    onChange={e => setCredentialId(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                                    title="Select Credential Profile"
                                >
                                    <option value="">-- Select Credential --</option>
                                    {availableCreds.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.username})</option>
                                    ))}
                                </select>
                                <div className="text-xs text-slate-400 mt-1">
                                    Manage credentials in the main configuration tab.
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 mb-6">
                        <button
                            className={`px-4 py-2 text-sm font-medium ${mode === 'simple' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setMode('simple')}
                        >
                            Visual Editor
                        </button>
                        <button
                            className={`px-4 py-2 text-sm font-medium ${mode === 'advanced' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => {
                                // Do NOT overwrite jsonConfig from patterns here. 
                                // This prevents data loss of advanced selectors that don't map to simple patterns.
                                // The jsonConfig is already loaded with full fidelity from the profile.
                                setMode('advanced');
                            }}
                        >
                            Advanced JSON
                        </button>
                    </div>

                    {mode === 'simple' ? (
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            {/* ... Existing Visual Editor Content ... */}
                            <div className="mb-6">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Configure Target:</label>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                    <button onClick={() => setActiveType('web')} className={getTypeButtonClass('web')}>
                                        <Layout size={20} /> Web Page
                                        {patterns['web'] && <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full"></div>}
                                    </button>
                                    <button onClick={() => setActiveType('image')} className={getTypeButtonClass('image')}>
                                        <ImageIcon size={20} /> Direct Image
                                        {patterns['image'] && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                    </button>
                                    <button onClick={() => setActiveType('pdf')} className={getTypeButtonClass('pdf')}>
                                        <FileText size={20} /> PDF Doc
                                        {patterns['pdf'] && <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>}
                                    </button>
                                    <button onClick={() => setActiveType('cad')} className={getTypeButtonClass('cad')}>
                                        <Box size={20} /> 3D/CAD
                                        {patterns['cad'] && <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full"></div>}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 text-center h-4">
                                    {activeType === 'web' ? 'Extracts Text, Prices, and Specs from an HTML page.' :
                                        activeType === 'image' ? 'Directly generates a link to the JPG/PNG file.' :
                                            activeType === 'pdf' ? 'Directly generates a link to the PDF document.' : 'Directly links to a CAD/3D file (STEP, DWG, etc).'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 mb-4 text-purple-700 font-semibold border-t border-slate-200 pt-4">
                                <Wand2 size={18} />
                                <h3>Teach URL Pattern ({activeType.toUpperCase()})</h3>
                            </div>
                            <p className="text-sm text-slate-600 mb-6">
                                Enter real data for <b>ONE product</b>, and paste its URL. The AI will learn the pattern.
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Product Ref (Code)</label>
                                    <input
                                        type="text"
                                        value={sampleRef} onChange={e => setSampleRef(e.target.value)}
                                        placeholder="e.g. 06019K3100"
                                        className="w-full p-2 border rounded mt-1 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Product Name</label>
                                    <input
                                        type="text"
                                        value={sampleName} onChange={e => setSampleName(e.target.value)}
                                        placeholder="e.g. Impact Drill 5000"
                                        className="w-full p-2 border rounded mt-1 bg-white"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="text-xs font-semibold text-slate-500 uppercase">
                                    Real {activeType} URL for this Product
                                </label>
                                <input
                                    type="url"
                                    value={currentExampleUrl}
                                    onChange={e => {
                                        setCurrentExampleUrl(e.target.value);
                                    }}
                                    placeholder={
                                        activeType === 'web' ? "https://site.com/product/impact-drill-5000" :
                                            activeType === 'pdf' ? "https://site.com/downloads/Drill5000.pdf" :
                                                "https://site.com/..."
                                    }
                                    className="w-full p-2 border rounded mt-1 bg-white font-mono text-sm text-blue-600"
                                />
                            </div>

                            <button
                                onClick={handleDetect}
                                disabled={isDetecting || !sampleRef || !currentExampleUrl}
                                className="w-full py-2 bg-slate-900 text-slate-100 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isDetecting ? 'Analyzing...' : <><TestTube size={16} /> Detect Pattern for {activeType}</>}
                            </button>

                            {/* Result */}
                            {currentDetected && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg animate-in fade-in">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 bg-green-200 text-green-700 rounded-full"><Check size={14} /></div>
                                        <div className="w-full">
                                            <h4 className="font-bold text-green-800 text-sm">Pattern Detected!</h4>
                                            <div className="mt-2 bg-white p-2 rounded border border-green-200 font-mono text-xs text-slate-700 break-all">
                                                {currentDetected.template}
                                            </div>
                                            <ul className="mt-2 text-xs text-green-700 space-y-1">
                                                {currentDetected.matches.map((m, i) => <li key={i}>• {m}</li>)}
                                            </ul>
                                        </div>
                                    </div>

                                    {activeType === 'image' && (
                                        <div className="mt-3 pt-3 border-t border-green-200">
                                            <p className="text-xs font-bold text-green-800 mb-2">Preview:</p>
                                            <div className="bg-white p-2 rounded border border-green-200 inline-block">
                                                <img src={currentExampleUrl} alt="Preview" className="h-32 w-auto object-contain" />
                                            </div>
                                        </div>
                                    )}
                                    {activeType === 'pdf' && (
                                        <div className="mt-3 text-xs">
                                            <a href={currentExampleUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Test Open PDF</a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 h-96 flex flex-col">
                            <h3 className="text-sm font-bold text-slate-700 mb-2">
                                <label htmlFor="jsonConfig">Advanced Configuration (JSON)</label>
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                                Directly edit the adapter configuration. Use this to define CSS selectors for Scrapers (e.g. Cheerio).
                                Changes here might be overwritten if you switch back to Visual Editor.
                            </p>
                            <textarea
                                id="jsonConfig"
                                className="flex-1 w-full bg-slate-900 text-slate-50 font-mono text-xs p-4 rounded-lg outline-none resize-none"
                                value={jsonConfig}
                                onChange={e => setJsonConfig(e.target.value)}
                                spellCheck={false}
                                title="Advanced Configuration JSON"
                                placeholder='{ "targets": { ... } }'
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button onClick={onClose} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !name}
                            className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-lg shadow-purple-200 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? 'Saving...' : <><Save size={18} /> Save Profile</>}
                        </button>
                    </div>

                </div>
            </div>
        </div >
    );
};

export default CeDossierEditor;
