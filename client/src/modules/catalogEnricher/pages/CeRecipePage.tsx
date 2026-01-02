
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ceClient } from '../api/ceClient';
import { Plus, Trash2, Edit2, Code, Globe, Play, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

interface RecipeStep {
    field: string;
    selector: string;
    type: 'text' | 'attribute' | 'html';
    attribute?: string;
}

interface Recipe {
    id: string;
    name: string;
    domain: string;
    start_url?: string;
    steps: RecipeStep[];
    updated_at: string;
}

const CeWizardPage = () => {
    const navigate = useNavigate();
    // Mode: 'list' | 'editor'
    const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');

    // List State
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(false);

    // Editor State
    const [currentRecipe, setCurrentRecipe] = useState<Partial<Recipe>>({ steps: [] });
    const [steps, setSteps] = useState<RecipeStep[]>([]);

    // Test State
    const [testUrl, setTestUrl] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        loadRecipes();
    }, []);

    const loadRecipes = async () => {
        setLoading(true);
        try {
            const list = await ceClient.getRecipes();
            setRecipes(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setCurrentRecipe({
            name: '',
            domain: '',
            steps: [
                { field: 'product_name', selector: 'h1', type: 'text' },
                { field: 'product_code', selector: '.sku', type: 'text' },
                { field: 'image_url', selector: 'img.main-image', type: 'attribute', attribute: 'src' },
                { field: 'description', selector: '.description', type: 'html' }
            ]
        });
        setSteps([
            { field: 'product_name', selector: 'h1', type: 'text' },
            { field: 'product_code', selector: '.sku', type: 'text' },
            { field: 'image_url', selector: 'img.main-image', type: 'attribute', attribute: 'src' }
        ]);
        setViewMode('editor');
        setTestResult(null);
        setTestUrl('');
    };

    const handleEdit = (r: Recipe) => {
        setCurrentRecipe(r);
        setSteps(r.steps || []);
        setViewMode('editor');
        setTestResult(null);
        setTestUrl(r.start_url || '');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this recipe?')) return;
        try {
            await ceClient.deleteRecipe(id);
            setRecipes(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            alert('Failed to delete');
        }
    };

    const handleSave = async () => {
        if (!currentRecipe.name || !currentRecipe.domain) return alert("Name and Domain are required");

        try {
            await ceClient.saveRecipe({
                ...currentRecipe,
                steps: steps
            } as any);
            setViewMode('list');
            loadRecipes();
        } catch (e: any) {
            alert('Save failed: ' + e.message);
        }
    };

    const handleTest = async () => {
        if (!testUrl) return alert("Enter a URL to test");
        setTesting(true);
        setTestResult(null);
        try {
            // NOTE: We need to implement this endpoint in backend or use previewCrawl
            // For now, let's assume we implement a test endpoint or reuse previewCrawl logic client-side
            // Simulating a call for UI Development mostly, will hook up backend next step
            // Actually, let's use previewCrawl but pass custom specific recipe logic if backend supports it?
            // Backend currently takes DB Profile ID. We probably need a 'test-scrape' endpoint that takes dynamic json.

            // Temporary Mock for UI Build (Step 1)
            // In Step 2 we add the backend logic
            const res = await ceClient.testScrape(testUrl, { ...currentRecipe, steps } as any);
            setTestResult(res);
        } catch (e: any) {
            setTestResult({ error: e.message });
        } finally {
            setTesting(false);
        }
    };

    const updateStep = (idx: number, field: keyof RecipeStep, value: string) => {
        const newSteps = [...steps];
        newSteps[idx] = { ...newSteps[idx], [field]: value };
        setSteps(newSteps);
    };

    const addStep = () => {
        setSteps([...steps, { field: 'new_field', selector: '', type: 'text' }]);
    };

    const removeStep = (idx: number) => {
        setSteps(steps.filter((_, i) => i !== idx));
    };

    if (viewMode === 'list') {
        return (
            <div className="p-8 max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/catalog-enricher')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <Code className="text-purple-600" /> Recipe Lab
                            </h2>
                            <p className="text-slate-500 text-sm">Create custom extraction rules for difficult websites.</p>
                        </div>
                    </div>
                    <button onClick={handleCreateNew} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium">
                        <Plus size={18} /> New Recipe
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Universal Card */}
                    <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-xl border border-purple-100 shadow-sm opacity-75">
                        <div className="flex justify-between items-start mb-4">
                            <div className="font-bold text-purple-800">✨ Universal Agent</div>
                        </div>
                        <p className="text-xs text-purple-600 mb-4">The default AI-powered extractor. Cannot be edited, but works on most sites.</p>
                        <div className="text-xs font-mono text-purple-400">System Built-in</div>
                    </div>

                    {recipes.map(r => (
                        <div key={r.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-800">{r.name}</h3>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEdit(r)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(r.id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mb-4 font-mono">
                                <Globe size={12} /> {r.domain}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {r.steps.slice(0, 3).map((s, i) => (
                                    <span key={i} className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 font-mono">{s.field}</span>
                                ))}
                                {r.steps.length > 3 && <span className="px-2 py-1 bg-slate-50 text-slate-400 text-xs">+{r.steps.length - 3}</span>}
                            </div>
                        </div>
                    ))}

                    {recipes.length === 0 && !loading && (
                        <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                            No custom recipes created yet.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // EDITOR MODE
    return (
        <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-64px)] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setViewMode('list')}>Recipes /</span>
                    {currentRecipe.id ? 'Edit Recipe' : 'New Recipe'}
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => setViewMode('list')} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2">
                        <CheckCircle size={18} /> Save Recipe
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Configuration Column */}
                <div className="col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                                <span className="text-xs font-bold text-slate-500 uppercase">Recipe Name</span>
                                <input
                                    type="text"
                                    value={currentRecipe.name}
                                    onChange={e => setCurrentRecipe({ ...currentRecipe, name: e.target.value })}
                                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                                    placeholder="e.g. Scrape Bette.de"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold text-slate-500 uppercase">Domain Scope</span>
                                <input
                                    type="text"
                                    value={currentRecipe.domain}
                                    onChange={e => setCurrentRecipe({ ...currentRecipe, domain: e.target.value })}
                                    className="w-full mt-1 p-2 border border-slate-300 rounded font-mono text-sm"
                                    placeholder="e.g. bette.de"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700">Extraction Steps (Selectors)</h3>
                            <button onClick={addStep} className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-bold">
                                <Plus size={14} /> Add Field
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 uppercase px-2">
                                <div className="col-span-3">Field Name</div>
                                <div className="col-span-4">CSS Selector</div>
                                <div className="col-span-2">Type</div>
                                <div className="col-span-2">Attribute</div>
                                <div className="col-span-1"></div>
                            </div>

                            {steps.map((step, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
                                    <div className="col-span-3">
                                        <input
                                            type="text"
                                            value={step.field}
                                            onChange={e => updateStep(idx, 'field', e.target.value)}
                                            className="w-full p-1 bg-white border border-slate-300 rounded text-sm font-bold text-slate-700"
                                            placeholder="field_name"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <input
                                            type="text"
                                            value={step.selector}
                                            onChange={e => updateStep(idx, 'selector', e.target.value)}
                                            className="w-full p-1 bg-white border border-slate-300 rounded font-mono text-xs text-blue-600"
                                            placeholder=".class > #id"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <select
                                            value={step.type}
                                            onChange={e => updateStep(idx, 'type', e.target.value as any)}
                                            className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                                        >
                                            <option value="text">Text Content</option>
                                            <option value="html">Inner HTML</option>
                                            <option value="attribute">Attribute</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="text"
                                            value={step.attribute || ''}
                                            onChange={e => updateStep(idx, 'attribute', e.target.value)}
                                            disabled={step.type !== 'attribute'}
                                            className="w-full p-1 bg-white border border-slate-300 rounded text-xs disabled:bg-slate-100 disabled:text-slate-300"
                                            placeholder={step.type === 'attribute' ? 'src, href...' : '-'}
                                        />
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <button onClick={() => removeStep(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tester Column */}
                <div className="col-span-1 space-y-6">
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-slate-300">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Play size={16} className="text-green-400" /> Test Runner
                        </h3>
                        <p className="text-xs mb-4">Paste a product URL to test your selectors live.</p>

                        <div className="mb-4">
                            <label className="text-xs font-bold uppercase mb-1 block">Test URL</label>
                            <input
                                type="text"
                                value={testUrl}
                                onChange={e => setTestUrl(e.target.value)}
                                className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-blue-300 focus:border-blue-500 outline-none"
                                placeholder="https://..."
                            />
                        </div>

                        <button
                            onClick={handleTest}
                            disabled={testing || !testUrl}
                            className="w-full py-2 bg-green-600 text-white font-bold rounded hover:bg-green-500 disabled:opacity-50 transition-colors"
                        >
                            {testing ? 'Running...' : 'Run Test'}
                        </button>

                        {testResult && (
                            <div className="mt-6 pt-6 border-t border-slate-700 animate-in fade-in">
                                {testResult.error ? (
                                    <div className="bg-red-900/50 p-3 rounded border border-red-800 text-red-300 text-xs">
                                        <div className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={12} /> Error</div>
                                        {testResult.error}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="text-xs font-bold text-green-400 uppercase">Extraction Result</div>
                                        {Object.entries(testResult).map(([k, v]: any) => (
                                            <div key={k} className="bg-slate-800 p-2 rounded border border-slate-700">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase">{k}</div>
                                                <div className="text-xs text-slate-200 mt-1 break-all font-mono">
                                                    {v ? v.toString().substring(0, 100) : <span className="text-slate-600 italic">null</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CeWizardPage;
