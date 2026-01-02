
import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { ceClient } from '../api/ceClient';
import { Play, Save, Trash2, FolderOpen, LayoutTemplate, Bot } from 'lucide-react';
import { CeRobotActiveJobs } from '../components/CeRobotActiveJobs';


const SOCKET_URL = 'http://localhost:4000'; // Hardcoded for now, should be env

export const CeTeacherTab = () => {
    const [url, setUrl] = useState('https://www.my-bette.com/en/product/baths');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isTeaching, setIsTeaching] = useState(false);


    // TABS
    const [activeSubTab, setActiveSubTab] = useState<'robot' | 'structure'>('robot');

    // The "Action Required" event data
    const [pendingAction, setPendingAction] = useState<any | null>(null);

    const [recipeSteps, setRecipeSteps] = useState<any[]>([]);

    const [replayResults, setReplayResults] = useState<any | null>(null);

    // Live Stream of actions (passive recording)
    const [actionStream, setActionStream] = useState<any[]>([]);

    // Track time for auto-wait
    const lastActionTime = React.useRef(Date.now());

    // RECIPES STATE
    const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');

    useEffect(() => {
        loadRecipes();
    }, []);

    const loadRecipes = async () => {
        try {
            const data = await ceClient.getRecipes();
            setSavedRecipes(data);
        } catch (e) {
            console.error("Failed to load recipes", e);
        }
    };

    const handleSaveRecipe = async () => {
        if (recipeSteps.length === 0) return alert("Nothing to save!");
        const name = prompt("Enter a name for this recipe:", `Bette Extraction ${new Date().toLocaleTimeString()}`);
        if (!name) return;

        try {
            await ceClient.saveRecipe({
                name,
                domain: new URL(url).hostname,
                start_url: url,
                steps: recipeSteps
            });
            alert("Recipe Saved!");
            loadRecipes();
        } catch (e: any) {
            alert("Save failed: " + e.message);
        }
    };

    const handleLoadRecipe = async () => {
        if (!selectedRecipeId) return;
        const recipe = savedRecipes.find(r => r.id === selectedRecipeId);
        if (recipe) {
            if (confirm(`Load recipe "${recipe.name}"? This will clear current steps.`)) {
                setRecipeSteps(recipe.steps);
                setUrl(recipe.start_url || url);
            }
        }
    };

    const handleDeleteRecipe = async () => {
        if (!selectedRecipeId) return;
        if (confirm("Are you sure you want to delete this recipe?")) {
            await ceClient.deleteRecipe(selectedRecipeId);
            loadRecipes();
            setSelectedRecipeId('');
        }
    };

    useEffect(() => {
        // Connect to Socket on mount
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => setIsConnected(true));
        newSocket.on('disconnect', () => setIsConnected(false));

        newSocket.on('teacher:interaction', (data) => {
            console.log("Interaction received:", data);

            // PASSIVE MODE LOGIC
            // If it's a normal click (isInspection == false), we just log it as a passive step.
            // If it's an inspection click (Alt+Click), we open the Extraction Modal.

            if (data.isInspection) {
                setPendingAction(data); // Open Extraction Modal
            } else {
                // Time Check for Auto-Wait
                const now = Date.now();
                const diff = now - lastActionTime.current;
                lastActionTime.current = now;

                if (diff > 2000) {
                    const waitStep = {
                        id: now - 1,
                        type: 'WAIT',
                        duration: Math.min(diff, 5000), // Cap at 5s to avoid boring replays
                        description: `Wait ${Math.min(diff, 5000)}ms`
                    };
                    setRecipeSteps(prev => [...prev, waitStep]);
                }

                // Passive Recording: Just add to stream/log
                // Optionally auto-add to recipe if "Auto-Record" is on?
                // For now, let's just log to "Action Stream" which the user can "Promote" to recipe if needed, 
                // OR we can AUTO-ADD click steps if we assume recording is ON.
                // Let's AUTO-ADD generic CLICKS to the recipe, but valid ones.
                const newStep = {
                    id: now,
                    type: data.href ? 'NAVIGATE' : 'PERFORM_CLICK',
                    description: data.href ? `Navigate: ${data.text || 'Link'}` : `Click: ${data.text || data.tag}`,
                    selector: data.selector,
                    href: data.href,
                    coordinates: { x: data.x, y: data.y }
                };
                setRecipeSteps(prev => [...prev, newStep]);
                setActionStream(prev => [newStep, ...prev].slice(0, 10)); // Keep last 10
            }
        });

        newSocket.on('teacher:replay_result', (data) => {
            console.log("Replay Result:", data);
            setReplayResults(data);
            alert(`Replay Finished! Extracted ${data.length} items.`);
        });

        newSocket.on('teacher:navigated', (data) => {
            // We can also record this as a passive confirmation step
            setActionStream(prev => [{ type: 'PAGE_LOAD', description: data.url }, ...prev].slice(0, 10));
        });

        return () => { newSocket.close(); };
    }, []);

    const performReplay = () => {
        if (!socket) return;
        setReplayResults(null);
        socket.emit('teacher:action', { action: 'REPLAY_RECIPE', steps: recipeSteps, url: url });
    };

    const handleStart = async () => {
        try {
            setIsTeaching(true);

            setRecipeSteps([]); // Clear recipe steps on new session
            setReplayResults(null);
            await ceClient.startTeacherSession(url);
        } catch (e: any) {
            alert(e.message);
            setIsTeaching(false);
        }
    };

    const handleStop = () => {
        if (socket) {
            // Send stop command? Or just disconnect?
            // Ideally server creates an endpoint to close
            // For now, let's just show the recipe
            console.log("Recipes Generated:", recipeSteps);
            setIsTeaching(false);
            socket.emit('teacher:action', { action: 'STOP_SESSION' });
        }
    };

    const sendAction = (actionType: string, fieldType?: string) => {
        if (!socket || !pendingAction) return;

        // Only for EXTRACTION now, since clicks are passive
        const newStep = {
            id: Date.now(),
            type: actionType,
            description: `Extract: ${fieldType?.toUpperCase()} (${pendingAction.tag})`,
            field: fieldType,
            selector: pendingAction.selector,
            coordinates: { x: pendingAction.x, y: pendingAction.y },
            text: pendingAction.text
        };
        setRecipeSteps(prev => [...prev, newStep]);

        // We tell backend to resume/ignore. Since we blocked it with preventDefault in spy (if inspection), 
        // we essentially just unblock or done. Actually for extraction we don't need to "resume" click 
        // because we don't want to follow the link, we just wanted data.
        // So we do nothing on socket except maybe clear flags.

        setPendingAction(null);
    };

    return (
        <div className="space-y-6">

            {/* ACTIVE JOBS VISUALIZATION - PERSISTENT HEADER */}
            <CeRobotActiveJobs socket={socket} />

            {/* SUB-TABS NAVIGATION */}
            <div className="flex gap-4 border-b border-slate-200 pb-2">
                <button
                    onClick={() => setActiveSubTab('robot')}
                    className={`flex items-center gap-2 px-4 py-2 font-bold rounded-t-lg transition-colors ${activeSubTab === 'robot' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Bot size={18} /> Product Robot
                </button>
                <button
                    onClick={() => setActiveSubTab('structure')}
                    className={`flex items-center gap-2 px-4 py-2 font-bold rounded-t-lg transition-colors ${activeSubTab === 'structure' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}
                >
                    <LayoutTemplate size={18} /> Site Structure
                </button>
            </div>

            {/* TAB 1: PRODUCT ROBOT (Existing Teacher Mode) */}
            {activeSubTab === 'robot' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                Teacher Mode <span className="text-xs font-normal text-slate-500">(Passive Recording)</span>
                                {isConnected ? <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Connected</span> : <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Disconnected</span>}
                            </h3>
                            {isTeaching && (
                                <button onClick={handleStop} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700">Stop Recording</button>
                            )}
                        </div>

                        {/* RECIPE MANAGER TOOLBAR */}
                        <div className="flex gap-4 mb-4 items-center bg-slate-100 p-2 rounded-lg">
                            <div className="flex items-center gap-2 flex-1">
                                <FolderOpen size={16} className="text-slate-500" />
                                <select
                                    value={selectedRecipeId}
                                    onChange={e => setSelectedRecipeId(e.target.value)}
                                    className="flex-1 p-1 border border-slate-300 rounded text-sm bg-white"
                                    title="Load Saved Recipe"
                                    aria-label="Load Saved Recipe"
                                >
                                    <option value="">-- Load Saved Recipe --</option>
                                    {savedRecipes.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.domain}) - {new Date(r.updated_at).toLocaleDateString()}</option>
                                    ))}
                                </select>
                                <button onClick={handleLoadRecipe} disabled={!selectedRecipeId} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
                                    Load
                                </button>
                                <button
                                    onClick={handleDeleteRecipe}
                                    disabled={!selectedRecipeId}
                                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200 disabled:opacity-50"
                                    title="Delete Recipe"
                                    aria-label="Delete Recipe"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div className="h-6 w-px bg-slate-300 mx-2"></div>
                            <button onClick={handleSaveRecipe} disabled={recipeSteps.length === 0} className="px-4 py-1.5 bg-slate-800 text-white rounded text-sm font-bold hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50">
                                <Save size={14} /> Save Current Recipe
                            </button>
                        </div>

                        {/* URL Input and Start/Test Buttons (Keep existing logic) */}
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                className="flex-1 p-2 border border-slate-300 rounded-lg text-sm font-mono"
                                placeholder="Enter URL to start..."
                                disabled={isTeaching}
                            />
                            {!isTeaching && (
                                <>
                                    {recipeSteps.length > 0 && <button onClick={performReplay} disabled={!isConnected} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"><Play size={18} /> Test Replay</button>}
                                    <button onClick={handleStart} disabled={!isConnected} className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"><Play size={18} /> Start Browser</button>
                                </>
                            )}
                        </div>

                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* LIVE STREAM HUD */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 h-96 overflow-y-auto font-mono text-xs text-green-400">
                            <h4 className="font-bold mb-2 text-white flex justify-between">
                                <span>Live Action Stream</span>
                                <span className="text-xs bg-slate-700 px-2 rounded text-slate-300">Auto-Recording</span>
                            </h4>
                            {actionStream.length === 0 && <p className="text-slate-600 italic">Interactions will appear here...</p>}
                            {actionStream.map((action, i) => (
                                <div key={i} className="mb-2 border-b border-slate-800 pb-2">
                                    <div className="font-bold text-white">{action.type}</div>
                                    <div className="opacity-75">{action.description}</div>
                                    <div className="text-[10px] text-slate-500">{action.selector}</div>
                                </div>
                            ))}
                        </div>

                        {/* RECIPE BUILDER */}
                        <div className="bg-white p-4 rounded-xl border border-blue-100 h-96 overflow-y-auto shadow-inner bg-blue-50/30">
                            <h4 className="font-bold text-blue-800 mb-2">Recipe Builder <span className="text-xs bg-blue-200 px-2 rounded-full">{recipeSteps.length} steps</span></h4>
                            <div className="space-y-2">
                                {recipeSteps.map((step, i) => (
                                    <div key={i} className="bg-white p-3 rounded border border-blue-200 flex items-start gap-3 shadow-sm">
                                        <div className="bg-blue-100 text-blue-700 w-6 h-6 flex justify-center items-center rounded-full text-xs font-bold shrink-0">{i + 1}</div>
                                        <div className="text-sm w-full">
                                            <div className="font-bold text-slate-800">{step.type}</div>
                                            <div className="text-slate-500 text-xs font-mono break-all">{step.selector}</div>
                                            {step.description && <div className="mt-1 text-xs bg-slate-50 p-1 rounded text-slate-600">{step.description}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {replayResults && (
                                <div className="mt-4 pt-4 border-t border-blue-200">
                                    <h5 className="text-xs font-bold text-green-700 mb-2">Extracted Data</h5>
                                    <pre className="text-xs font-mono bg-slate-900 text-green-400 p-2 rounded overflow-auto max-h-40">{JSON.stringify(replayResults, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* EXTRACTION MODAL (Only shows on Alt+Click) */}
                    {pendingAction && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="bg-purple-900 text-white p-4 flex justify-between items-center">
                                    <h3 className="font-bold flex items-center gap-2">Extract Content</h3>
                                    <button onClick={() => setPendingAction(null)} className="hover:text-red-300"><code className="text-xs">Cancel</code></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-sm">
                                        <div className="font-bold text-purple-900">Target Element: {pendingAction.tag}</div>
                                        <div className="font-mono text-xs text-purple-700 break-all mt-1">{pendingAction.selector}</div>
                                        <div className="text-slate-600 italic mt-2">"{pendingAction.text || 'No text'}"</div>
                                    </div>

                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Field Type</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => sendAction('EXTRACT_FIELD', 'name')} className="p-3 border rounded hover:bg-green-50 font-bold text-slate-700">Product Name</button>
                                        <button onClick={() => sendAction('EXTRACT_FIELD', 'sku')} className="p-3 border rounded hover:bg-green-50 font-bold text-slate-700">SKU / Ref</button>
                                        <button onClick={() => sendAction('EXTRACT_FIELD', 'image')} className="p-3 border rounded hover:bg-purple-50 font-bold text-slate-700">Product Image</button>
                                        <button onClick={() => sendAction('EXTRACT_FIELD', 'file')} className="p-3 border rounded hover:bg-blue-50 font-bold text-slate-700">PDF / Document</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: STRUCTURE SCANNER (Placeholder) */}
            {/* TAB 2: STRUCTURE SCANNER */}
            {activeSubTab === 'structure' && (
                <StructureScannerTab initialUrl={url} socket={socket} />
            )}
        </div>
    );
};

const StructureScannerTab = ({ initialUrl, socket }: { initialUrl: string, socket: Socket | null }) => {
    const [scanUrl, setScanUrl] = useState(initialUrl);
    const [tree, setTree] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState('');
    const [saved, setSaved] = useState(false);
    const [existingProfiles, setExistingProfiles] = useState<any[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [useDeepScan, setUseDeepScan] = useState(false);

    // BULK CRAWL STATE
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]); // URLs of selected categories
    const [availableRecipes, setAvailableRecipes] = useState<any[]>([]);
    const [selectedRecipeId, setSelectedRecipeId] = useState('');

    useEffect(() => {
        // Load profiles
        ceClient.getProfiles().then(setExistingProfiles).catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedProfileId) {
            // Load existing taxonomy if profile selected
            ceClient.getTaxonomyTree(selectedProfileId).then(savedTree => {
                if (savedTree && savedTree.length > 0) {
                    setTree(enrichWithIds(savedTree));
                    setSaved(true);
                } else {
                    // Don't auto-clear if we just manually scanned
                    // Only clear if user explicitly changed profile without a scan
                }
            }).catch(e => console.error("Failed to load taxonomy", e));

            // Load Recipes
            const profile = existingProfiles.find(p => p.id === selectedProfileId);
            if (profile) {
                ceClient.getRecipes(profile.domain).then(res => {
                    setAvailableRecipes(res);
                    if (res.length === 0) setSelectedRecipeId('universal');
                }).catch(console.error);
            }
        }
    }, [selectedProfileId, existingProfiles]);

    // Helper to generate UI IDs
    const enrichWithIds = (nodes: any[]): any[] => {
        const traverse = (list: any[]): any[] => {
            return list.map(node => ({
                ...node,
                _ui_id: node._ui_id || Math.random().toString(36).substr(2, 9),
                children: node.children ? traverse(node.children) : []
            }));
        };
        return traverse(nodes);
    };

    const handleScan = async () => {
        if (!scanUrl) return alert("Enter URL");
        setScanning(true);
        setSaved(false);
        setScanStatus('Iniciando...');

        const scanJobId = 'scan_' + Math.random().toString(36).substr(2, 9);

        // Listen for progress
        const statusHandler = (data: any) => {
            if (data.scanJobId === scanJobId) {
                setScanStatus(data.message);
            }
        };
        if (socket) socket.on('scan-status', statusHandler);

        try {
            const domain = new URL(scanUrl).hostname;
            const res = await ceClient.post('/crawler/scan-structure', { url: scanUrl, domain, deep: useDeepScan, scanJobId });

            let nodes = Array.isArray(res.tree) ? res.tree : [res.tree];
            if (nodes.length === 1 && nodes[0].name === "root" && nodes[0].children) {
                nodes = nodes[0].children;
            }

            // Enrich with UI IDs for unique selection
            setTree(enrichWithIds(nodes));
        } catch (e: any) {
            alert("Scan Failed: " + e.message);
        } finally {
            setScanning(false);
            setScanStatus('');
            if (socket) socket.off('scan-status', statusHandler);
        }
    };

    const handleSave = async () => {
        if (tree.length === 0) return;

        let profileId = selectedProfileId;
        const domain = new URL(scanUrl).hostname;

        if (!profileId) {
            const existing = existingProfiles.find(p => p.domain === domain);
            if (existing) {
                profileId = existing.id;
            } else {
                if (confirm(`No profile found for ${domain}. Create new profile?`)) {
                    try {
                        const newProfile = await ceClient.createProfile({ name: domain, domain: domain });
                        profileId = newProfile.id;
                        setExistingProfiles(prev => [...prev, newProfile]);
                        setSelectedProfileId(newProfile.id);
                    } catch (e) {
                        return alert("Failed to create profile");
                    }
                } else {
                    return;
                }
            }
        }

        try {
            // Strip UI IDs before saving? Backend ignores excessive fields usually, but cleaner to strip.
            // Actually, keep them or let backend generate DB IDs. TaxonomyService generates its own UUIDs.
            await ceClient.saveTaxonomyTree(profileId, tree);
            setSaved(true);
            alert("Structure Saved Successfully!");
        } catch (e: any) {
            alert("Save Failed: " + e.message);
        }
    };

    const handleBulkExtract = async () => {
        if (!selectedRecipeId) return alert("Please select a Recipe used to extract products.");
        if (selectedNodes.length === 0) return alert("Please select at least one category to crawl.");

        // Convert selected Node IDs back to URLs
        const urlsToCrawl = new Set<string>();
        const findUrls = (nodes: any[]) => {
            for (const node of nodes) {
                if (selectedNodes.includes(node._ui_id) && node.url) {
                    urlsToCrawl.add(node.url);
                }
                if (node.children) findUrls(node.children);
            }
        };
        findUrls(tree);

        const finalUrls = Array.from(urlsToCrawl);

        console.log('[Bulk Debug] Requesting Bulk Crawl');
        console.log('[Bulk Debug] Selected Node IDs:', selectedNodes);
        console.log('[Bulk Debug] Tree Root:', tree);
        console.log('[Bulk Debug] Resolved URLs:', finalUrls);

        if (finalUrls.length === 0) return alert("No valid URLs found in selection.");

        const confirmMsg = `Start Bulk Extraction?\n\nCategories/Products: ${finalUrls.length}\nRecipe ID: ${selectedRecipeId}\nProfile: ${selectedProfileId}`;
        if (!confirm(confirmMsg)) return;

        try {
            const res = await ceClient.startBulkCrawl(selectedProfileId, selectedRecipeId, finalUrls);
            alert(`Bulk Crawl Started! Job ID: ${res.jobId}\nCheck the "Product Robot" tab or logs for progress.`);
        } catch (e: any) {
            alert("Failed to start bulk crawl: " + e.message);
        }
    };

    const toggleNode = (node: any) => {
        if (!node) return;

        const getAllDescendantIds = (n: any): string[] => {
            let ids: string[] = [];
            if (n._ui_id && n.url) ids.push(n._ui_id); // Only selectable if valid URL
            if (n.children) {
                for (const child of n.children) {
                    ids = [...ids, ...getAllDescendantIds(child)];
                }
            }
            return ids;
        };

        const descendantIds = getAllDescendantIds(node);
        // Check selection by ID
        const isSelected = selectedNodes.includes(node._ui_id);

        if (isSelected) {
            // Deselect self and all children
            setSelectedNodes(prev => prev.filter(id => !descendantIds.includes(id)));
        } else {
            // Select self and all children
            setSelectedNodes(prev => [...new Set([...prev, ...descendantIds])]);
        }
    };


    const handleNodeExpand = async (node: any) => {
        if (!node.url || (node.children && node.children.length > 0)) return; // Already has children or no URL

        // Lazy Load Children (Deep Scan Single Node)
        // Set a loading flag safely on the node (conceptually) - or tracked via state
        // For simplicity, we might force a re-scan of just that URL but we need to know where to attach it.
        // EASIER STRATEGY: We re-scan URL and UPDATE the tree.

        console.log(`📂 Expanding: ${node.name} (${node.url})`);
        // Find node in tree and set loading state? 
        // We'll update the tree state directly.

        const updateTreeWithChildren = (nodes: any[], targetId: string, newChildren: any[]): any[] => {
            return nodes.map(n => {
                if (n._ui_id === targetId) {
                    return { ...n, children: enrichWithIds(newChildren), _expanded: true };
                }
                if (n.children) {
                    return { ...n, children: updateTreeWithChildren(n.children, targetId, newChildren) };
                }
                return n;
            });
        };

        // UI Feedback: Set temporary loading state
        setTree(prev => {
            const setLoad = (list: any[]): any[] => list.map(n => n._ui_id === node._ui_id ? { ...n, _loading: true } : { ...n, children: n.children ? setLoad(n.children) : [] });
            return setLoad(prev);
        });

        try {
            // Using existing Scan Structure API but limited depth
            const res = await ceClient.scanStructure(node.url, new URL(node.url).hostname, false);
            // Expecting 'tree' or list. The backend might return the root again.
            // If it returns a Root Node for that URL, its children are what we want.

            let newChildren: any[] = [];
            const resultNode = Array.isArray(res.tree) ? res.tree[0] : res.tree;

            if (resultNode && resultNode.children) {
                newChildren = resultNode.children;
            } else if (Array.isArray(res.tree) && res.tree.length > 1) {
                newChildren = res.tree; // Flat list?
            }

            setTree(prev => updateTreeWithChildren(prev, node._ui_id, newChildren));

        } catch (e) {
            console.error("Expand failed", e);
            alert("Failed to load subs: " + (e as any).message);
            // Clear loading
            setTree(prev => {
                const clearLoad = (list: any[]): any[] => list.map(n => n._ui_id === node._ui_id ? { ...n, _loading: false } : { ...n, children: n.children ? clearLoad(n.children) : [] });
                return clearLoad(prev);
            });
        }
    };

    const toggleNodeExpand = (node: any) => {
        if (node._loading) return;

        // If it has children already, just toggle visibility (we'll need a _expanded UI state)
        // If it has NO children and HAS URL, try to load.

        if (!node.children || node.children.length === 0) {
            if (node.url) {
                handleNodeExpand(node);
            }
            return;
        }

        // Toggle Expanded State locally
        setTree(prev => {
            const toggle = (list: any[]): any[] => list.map(n => {
                if (n._ui_id === node._ui_id) return { ...n, _expanded: !n._expanded };
                if (n.children) return { ...n, children: toggle(n.children) };
                return n;
            });
            return toggle(prev);
        });
    }


    const RecursiveTree = ({ nodes }: { nodes: any[] }) => {
        if (!nodes || nodes.length === 0) return null;
        return (
            <ul className="pl-4 border-l border-slate-200 space-y-2 mt-2">
                {nodes.map((node, i) => (
                    <li key={i} className="text-sm">
                        <div className="flex items-center gap-2 group">
                            {/* EXPANDER */}
                            <button
                                onClick={() => toggleNodeExpand(node)}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-500"
                            >
                                {node._loading ? (
                                    <div className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-purple-600 animate-spin"></div>
                                ) : (
                                    node.children && node.children.length > 0 ? (
                                        node._expanded ? <FolderOpen size={14} className="text-blue-500" /> : <div className="text-slate-400 rotate-90 text-[10px]">▶</div>
                                    ) : (
                                        // Can we expand it?
                                        node.url ? <div className="text-slate-300 text-[10px]">▶</div> : <div className="w-3 h-3" />
                                    )
                                )}
                            </button>

                            <input
                                id={`nodeSelectCheckbox-${node._ui_id}`}
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                checked={!!(node._ui_id && selectedNodes.includes(node._ui_id))}
                                onChange={() => toggleNode(node)}
                                disabled={!node.url}
                                title="Select Category"
                            />
                            <label htmlFor={`nodeSelectCheckbox-${node._ui_id}`} className="sr-only">Select {node.name}</label>

                            <span className={`font-bold ${!node.url ? 'text-slate-400' : 'text-slate-700'}`}>{node.name}</span>
                            <span className="text-xs text-slate-400 font-mono">({node.node_kind || node.type})</span>
                            {/* PREVIEW COUNT if available */}
                            {node.product_count !== undefined && <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500">{node.product_count} items</span>}

                            {node.url && <a href={node.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">Link</a>}
                        </div>
                        {/* Only show children if expanded */}
                        {node.children && node._expanded && <RecursiveTree nodes={node.children} />}
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Site Structure AI Scanner</h3>
                        <p className="text-slate-500 text-sm">Automatically detect categories and collections to build the taxonomy tree.</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                            <select
                                value={selectedProfileId}
                                onChange={e => setSelectedProfileId(e.target.value)}
                                className="p-2 border border-slate-300 rounded-lg text-sm min-w-[200px]"
                                title="Select Profile"
                                aria-label="Select Profile"
                            >
                                <option value="">-- Load / Select Profile --</option>
                                {existingProfiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>
                                ))}
                            </select>

                            {tree.length > 0 && (
                                <button
                                    onClick={handleSave}
                                    disabled={saved || !selectedProfileId}
                                    className={`px-6 py-2 rounded-lg font-bold text-white flex items-center gap-2 ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'}`}
                                    title={saved ? 'Structure Saved' : 'Save Structure'}
                                >
                                    <Save size={18} /> {saved ? 'Saved' : 'Save Structure'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    <input
                        type="text"
                        value={scanUrl}
                        onChange={e => setScanUrl(e.target.value)}
                        className="flex-1 p-3 border border-slate-300 rounded-lg text-sm font-mono"
                        placeholder="Enter Homepage URL (e.g. https://brand.com)..."
                        title="Enter Homepage URL"
                        aria-label="Enter Homepage URL"
                    />
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg cursor-pointer border border-slate-200" title="Toggle Deep Scan">
                        <input
                            type="checkbox"
                            checked={useDeepScan}
                            onChange={e => setUseDeepScan(e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            aria-label="Deep Scan"
                        />
                        <span className="text-sm font-bold text-slate-700">Deep Scan</span>
                    </label>
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={handleScan}
                            disabled={scanning}
                            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 min-w-[160px] justify-center"
                            title={scanning ? 'Scanning...' : 'Scan Structure'}
                        >
                            {scanning ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Bot size={18} />}
                            {scanning ? 'Scanning...' : 'Scan Structure'}
                        </button>
                        {scanning && scanStatus && (
                            <div className="text-[10px] text-purple-600 font-bold text-center animate-pulse">{scanStatus}</div>
                        )}
                    </div>
                </div>

                {tree.length === 0 && !scanning && (
                    <div className="mt-8 text-center text-slate-400 py-10 border-2 border-dashed border-slate-100 rounded-lg">
                        <LayoutTemplate size={48} className="mx-auto mb-2 opacity-20" />
                        <p>Enter a URL and click Scan to visualize the site structure.</p>
                    </div>
                )}
            </div>

            {tree.length > 0 && (
                <div className="grid grid-cols-3 gap-6">
                    {/* LEFT: TREE */}
                    <div className="col-span-2 bg-white p-6 rounded-xl border border-slate-200 min-h-[400px]">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h4 className="font-bold text-slate-800">Detected Structure</h4>
                            <div className="text-xs text-slate-500">
                                {selectedNodes.length} categories selected
                            </div>
                        </div>
                        <RecursiveTree nodes={tree} />
                    </div>

                    {/* RIGHT: ACTIONS */}
                    <div className="col-span-1 space-y-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <Bot size={18} className="text-purple-600" /> Bulk Extraction
                            </h4>
                            <p className="text-slate-500 text-sm mb-4">
                                Select categories from the tree and a recipe to extract products in bulk.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase">Extraction Recipe</label>
                                    <select
                                        className="w-full mt-1 p-2 border border-slate-300 rounded text-sm bg-white"
                                        value={selectedRecipeId}
                                        onChange={e => setSelectedRecipeId(e.target.value)}
                                        title="Select Extraction Recipe"
                                        aria-label="Select Extraction Recipe"
                                    >
                                        <option value="">-- Select Recipe --</option>
                                        <option value="universal" className="font-bold text-purple-700">✨ Universal / Auto-Detect (Smart)</option>
                                        {availableRecipes.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    <div className="mt-2 flex justify-between items-center text-xs">
                                        {availableRecipes.length === 0 && selectedProfileId ? (
                                            <span className="text-slate-500">No custom recipes found.</span>
                                        ) : <span></span>}
                                        <a href="/catalog-enricher/recipes" className="text-purple-600 font-bold hover:underline">
                                            + Manage Recipes
                                        </a>
                                    </div>
                                </div>

                                <button
                                    onClick={handleBulkExtract}
                                    disabled={selectedNodes.length === 0 || !selectedRecipeId}
                                    className="w-full py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 shadow-lg shadow-purple-200"
                                >
                                    Start Bulk Extraction
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
