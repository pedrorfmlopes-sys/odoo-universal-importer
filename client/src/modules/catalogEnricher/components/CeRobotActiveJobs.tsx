import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Loader2, CheckCircle, Layers, Pause, Play, Square } from 'lucide-react';
import { ceClient } from '../api/ceClient'; // Import Client

interface JobProgress {
    jobId: string;
    progress: number;
    processed: number;
    total: number;
    status: 'running' | 'completed' | 'failed' | 'paused' | 'stopped';
    itemsFound: number;
    totalProducts: number;
    productsProcessed: number;
    message: string;
    updatedAt: number;
}

interface Props {
    socket: Socket | null;
}

export const CeRobotActiveJobs: React.FC<Props> = ({ socket }) => {
    const [jobs, setJobs] = useState<Record<string, JobProgress>>({});

    // 1. Initial Sync (Reconnection Support)
    useEffect(() => {
        ceClient.getActiveJobs().then(res => {
            if (res.jobs && res.jobs.length > 0) {
                const jobMap: Record<string, JobProgress> = {};
                res.jobs.forEach(j => {
                    jobMap[j.id] = {
                        jobId: j.id,
                        progress: j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0,
                        processed: j.processed,
                        total: j.total,
                        status: j.status,
                        itemsFound: j.itemsFound || 0,
                        totalProducts: j.totalProducts || 0,
                        productsProcessed: j.productsProcessed || 0,
                        message: j.status === 'paused' ? 'Job Paused' : 'Syncing...',
                        updatedAt: Date.now()
                    };
                });
                setJobs(jobMap);
            }
        }).catch(console.error);
    }, []);

    // 2. Real-time Updates
    useEffect(() => {
        if (!socket) return;

        const handleProgress = (data: any) => {
            setJobs(prev => ({
                ...prev,
                [data.jobId]: { ...prev[data.jobId], ...data, updatedAt: Date.now() }
            }));
        };

        const handleStatus = (data: { status: string }) => {
            // Global queue status update - apply to all running jobs basically
            setJobs(prev => {
                const updated = { ...prev };
                Object.keys(updated).forEach(k => {
                    if (updated[k].status !== 'completed' && updated[k].status !== 'stopped') {
                        updated[k].status = data.status as any;
                    }
                });
                return updated;
            });
        };

        const handleCompletion = (data: { jobId: string, status: string }) => {
            setJobs(prev => ({
                ...prev,
                [data.jobId]: { ...prev[data.jobId], status: data.status as any, message: 'Job Stopped/Finished' }
            }));
        };

        socket.on('job-progress', handleProgress);
        socket.on('queue-status', handleStatus);
        socket.on('job-completed', handleCompletion);

        return () => {
            socket.off('job-progress', handleProgress);
            socket.off('queue-status', handleStatus);
            socket.off('job-completed', handleCompletion);
        };
    }, [socket]);

    const handlePause = async () => {
        await ceClient.pauseQueue();
    };

    const handleResume = async () => {
        await ceClient.resumeQueue();
    };

    const handleStop = async (jobId: string) => {
        const choice = confirm("Stop Extraction?\n\nCancel: Go Back\nOK: Stop Job (Keep Data)");
        if (!choice) return;

        const deleteData = confirm("Do you want to DELETE extracted data for this session to clean up residues?");
        await ceClient.stopJob(jobId, deleteData);

        // Remove from UI after delay
        setTimeout(() => {
            setJobs(prev => {
                const next = { ...prev };
                delete next[jobId];
                return next;
            });
        }, 2000);
    };

    const calculateETA = (total: number, processed: number): string => {
        const remaining = total - processed;
        if (remaining <= 0) return 'Finishing...';

        // Dynamic estimate: First item takes longer (~45s), subsequent ones might be cached/faster (say 30s avg?)
        // Let's go with safe 45s to avoid underestimating
        const secPerItem = 45;
        const totalSec = remaining * secPerItem;

        if (totalSec < 60) return `~${totalSec}s left`;
        const mins = Math.floor(totalSec / 60);
        return `~${mins} min left`;
    };

    const activeJobList = Object.values(jobs).sort((a, b) => b.updatedAt - a.updatedAt);

    if (activeJobList.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400">
                <Layers className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-sm">No active bulk jobs running.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h4 className="font-bold text-slate-700 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin text-purple-600" size={16} /> Active Crawl Jobs
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePause} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="Pause All"><Pause size={16} /></button>
                    <button onClick={handleResume} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="Resume All"><Play size={16} /></button>
                    <button onClick={() => {
                        ceClient.getActiveJobs().then(res => {
                            if (res.jobs) {
                                setJobs(prev => {
                                    const next = { ...prev };
                                    res.jobs.forEach(j => {
                                        next[j.id] = {
                                            jobId: j.id,
                                            progress: j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0,
                                            processed: j.processed,
                                            total: j.total,
                                            status: j.status,
                                            itemsFound: j.itemsFound || 0,
                                            totalProducts: j.totalProducts || 0,
                                            productsProcessed: j.productsProcessed || 0,
                                            message: j.status === 'paused' ? 'Job Paused' : 'Synced from Server',
                                            updatedAt: Date.now()
                                        };
                                    });
                                    return next;
                                });
                            }
                        });
                    }} className="p-1 hover:bg-slate-100 rounded text-blue-500" title="Sync Status"><Loader2 size={16} className={false ? "animate-spin" : ""} /></button>
                </div>
            </h4>

            {activeJobList.map(job => (
                <div key={job.jobId} className={`bg-white p-4 rounded-xl border ${job.status === 'paused' ? 'border-amber-200 bg-amber-50' : 'border-slate-200'} shadow-sm animate-in fade-in slide-in-from-right-4`}>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="text-xs font-mono text-slate-400 mb-1 flex items-center gap-2">
                                {job.jobId}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${job.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {job.status}
                                </span>
                            </div>
                            <div className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{job.message}</div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-xl font-bold text-purple-600">{job.progress}%</span>
                            <button
                                onClick={() => handleStop(job.jobId)}
                                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                            >
                                <Square size={10} fill="currentColor" /> Stop
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                        <svg width="100%" height="8" className="block">
                            <rect
                                width={`${job.progress}%`}
                                height="8"
                                rx="4"
                                fill={job.status === 'paused' ? '#fbbf24' : '#9333ea'}
                                className="transition-all duration-500"
                            />
                        </svg>
                    </div>

                    <div className="flex justify-between text-xs text-slate-500 font-mono">
                        <div className="flex gap-3 items-center">
                            <span>Cats: {job.processed} / {job.total}</span>
                            {job.status === 'running' && (
                                <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
                                    ⏱ {calculateETA(job.total, job.processed)}
                                </span>
                            )}
                        </div>
                        <span className="flex items-center gap-1 text-green-600 font-bold">
                            <CheckCircle size={10} /> Found {job.itemsFound} Items
                        </span>
                    </div>

                    {/* NEW: Secondary Product Counter */}
                    {job.totalProducts > 0 && (
                        <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                            <span>Processamento de Itens</span>
                            <span className="text-purple-600 font-mono">
                                {job.productsProcessed} / {job.totalProducts} Concluídos
                            </span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
