import React, { useEffect, useState } from 'react';
import { ceClient } from '../api/ceClient';
import { Loader2, Pause, Play, Square, CheckCircle, Database, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

interface Job {
    id: string;
    total: number;
    processed: number;
    status: 'running' | 'paused' | 'waiting_commit' | 'completed' | 'stopped';
    itemsFound: number;
    totalProducts?: number;
    productsProcessed?: number;
    progress?: number;
}

export const CeJobMonitor: React.FC = () => {
    const [activeJob, setActiveJob] = useState<Job | null>(null);
    const [minimized, setMinimized] = useState(false);
    const [isSuppressed, setIsSuppressed] = useState(false);
    const navigate = useNavigate();

    // SOCKET & POLLING HYBRID STRATEGY
    useEffect(() => {
        if (isSuppressed) return;

        // 1. Initial Check (Only once on mount)
        const checkActive = async () => {
            try {
                const res = await ceClient.getActiveJobs();
                if (res.jobs && res.jobs.length > 0) {
                    const job = res.jobs.find((j: any) => j.status !== 'completed' && j.status !== 'stopped') as Job;
                    if (job) setActiveJob(job);
                }
            } catch (e) { console.error("[JobMonitor] Initial check failed", e); }
        };
        checkActive();

        // 2. Socket Connection
        const socketUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
        const socket = io(socketUrl);

        socket.on('job-progress', (data: any) => {
            setActiveJob(prev => {
                // If we already have this job, update it
                if (prev && prev.id === data.jobId) {
                    return {
                        ...prev,
                        ...data,
                        progress: data.progress
                    };
                }
                // If we have NO job, and this one is running/pending, take it!
                if (!prev && (data.status === 'running' || data.status === 'pending')) {
                    return {
                        id: data.jobId,
                        total: data.total || 0,
                        processed: data.processed || 0,
                        status: data.status,
                        itemsFound: data.itemsFound || 0,
                        totalProducts: data.totalProducts || 0,
                        productsProcessed: data.productsProcessed || 0,
                        progress: data.progress || 0
                    };
                }
                return prev;
            });
        });

        socket.on('job-completed', (data: any) => {
            setActiveJob(prev => {
                if (prev && prev.id === data.jobId) {
                    const finishedJob = { ...prev, status: 'completed' as any };

                    // Auto-dismiss after 10 seconds if completed/stopped
                    setTimeout(() => {
                        setActiveJob(current => (current && current.id === data.jobId ? null : current));
                    }, 10000);

                    return finishedJob;
                }
                return prev;
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [isSuppressed]);

    // ... handlers ...

    // Update Force Close logic
    /* 
                                    onClick={() => {
                                        // Force Close Logic
                                        if (confirm("Force Close Monitor? (This stops tracking locally only)")) {
                                            setIsSuppressed(true); // Enable suppression
                                            setActiveJob(null);
                                        }
                                    }} 
    */

    const handleCommit = async () => {
        if (!activeJob) return;
        if (!confirm("Confirm transfer of extracted data to main Catalog?")) return;

        try {
            await ceClient.commitJob(activeJob.id);
            alert("Data Transferred Successfully!");
            setActiveJob(null); // Will disappear on next poll
            navigate('/catalog-enricher/catalog');
        } catch (e: any) { alert("Commit failed: " + e.message); }
    };

    const handleStop = async () => {
        if (!activeJob) return;
        if (!confirm("Stop job? Data extracted so far will be kept in staging.")) return;
        // For now, allow stop without delete
        await ceClient.stopJob(activeJob.id, false);
    };

    const handlePause = async () => activeJob?.status === 'running' ? ceClient.pauseQueue() : ceClient.resumeQueue();

    if (!activeJob) return null;

    const progress = activeJob.progress !== undefined ? activeJob.progress : Math.round((activeJob.processed / activeJob.total) * 100);

    return (
        <div className={`fixed bottom-6 right-6 z-[9999] transition-all ${minimized ? 'w-16 h-16' : 'w-96'}`}>
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                {minimized ? (
                    <div
                        className="h-full w-full flex items-center justify-center cursor-pointer bg-blue-600 text-white"
                        onClick={() => setMinimized(false)}
                    >
                        <Loader2 className="animate-spin" />
                    </div>
                ) : (
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Database size={16} className="text-blue-600" />
                                Extraction Job <span className="text-[10px] text-slate-400 font-mono">(v3.0)</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setMinimized(true)} className="text-slate-400 hover:text-slate-600 text-xs">MINIMIZE</button>
                                <button
                                    onClick={() => {
                                        // Force Close Logic - NOW PERSISTENT
                                        if (confirm("Force Close Monitor? (This will ignore new jobs until refresh)")) {
                                            setIsSuppressed(true);
                                            setActiveJob(null);
                                        }
                                    }}
                                    className="p-1 text-slate-300 hover:text-red-500 rounded hover:bg-red-50"
                                    title="Force Close Monitor (Stop Tracking)"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>
                                    {activeJob.status === 'waiting_commit' && 'WAITING APPROVAL'}
                                    {activeJob.status === 'completed' && 'COMPLETED'}
                                    {activeJob.status === 'running' && 'Processing...'}
                                    {activeJob.status === 'paused' && 'Paused'}
                                </span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <svg width="100%" height="8" className="block">
                                    <rect
                                        width={`${progress}%`}
                                        height="8"
                                        rx="4"
                                        fill={activeJob.status === 'waiting_commit' ? '#f97316' :
                                            activeJob.status === 'completed' ? '#16a34a' : '#2563eb'
                                        }
                                        className="transition-all duration-500"
                                    />
                                </svg>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <div className="text-lg font-bold text-slate-800">
                                    {activeJob.productsProcessed !== undefined && activeJob.totalProducts ?
                                        `${activeJob.productsProcessed}/${activeJob.totalProducts}` :
                                        activeJob.itemsFound
                                    }
                                </div>
                                <div className="text-xs text-slate-500">Products</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <div className="text-lg font-bold text-slate-800">{activeJob.processed}/{activeJob.total}</div>
                                <div className="text-xs text-slate-500">Categories</div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            {activeJob.status === 'completed' || activeJob.status === 'stopped' || (activeJob.processed >= activeJob.total && activeJob.total > 0) ? (
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => setActiveJob(null)}
                                        className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg font-bold flex justify-center items-center gap-2"
                                    >
                                        <CheckCircle size={18} /> Close Monitor
                                    </button>
                                </div>
                            ) : activeJob.status === 'waiting_commit' ? (
                                <button
                                    onClick={handleCommit}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold flex justify-center items-center gap-2"
                                >
                                    <CheckCircle size={18} /> Commit to Catalog
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handlePause}
                                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg flex justify-center items-center"
                                        title={activeJob.status === 'paused' ? "Resume Queue" : "Pause Queue"}
                                        aria-label={activeJob.status === 'paused' ? "Resume Queue" : "Pause Queue"}
                                    >
                                        {activeJob.status === 'paused' ? <Play size={18} /> : <Pause size={18} />}
                                    </button>
                                    <button
                                        onClick={handleStop}
                                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg flex justify-center items-center"
                                        title="Stop Job"
                                        aria-label="Stop Job"
                                    >
                                        <Square size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

    );
};
