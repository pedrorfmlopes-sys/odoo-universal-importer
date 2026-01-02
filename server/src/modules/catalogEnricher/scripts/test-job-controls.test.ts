import { ceQueueService } from '../services/ceQueueService';
import { ceRecipeService } from '../services/ceRecipeService';

// Mock PQueue class
const mockPause = jest.fn();
const mockStart = jest.fn();
const mockClear = jest.fn();
const mockAdd = jest.fn();

jest.mock('p-queue', () => {
    return class MockPQueue {
        constructor() { }
        add(fn: any) { return mockAdd(fn); }
        pause() { mockPause(); }
        start() { mockStart(); }
        clear() { mockClear(); }
        get size() { return 0; }
        get pending() { return 0; }
        get isPaused() { return false; }
    };
});

jest.mock('../db/ceDatabase', () => ({
    getCeDatabase: () => ({
        prepare: jest.fn().mockReturnValue({ run: jest.fn(), all: jest.fn().mockReturnValue([]) })
    })
}));

jest.mock('../services/ceRecipeService', () => ({
    ceRecipeService: { getRecipe: jest.fn() }
}));

jest.mock('../services/ceAiService', () => ({
    ceAiService: { getCachedNodeKind: jest.fn() }
}));

// We need to access the private queue inside ceQueueService in real app, 
// strictly speaking we should export it or test via side effects.
// For now, let's test the state changes.

describe('Job Controls', () => {
    it('should report active jobs', () => {
        const jobs = ceQueueService.getActiveJobs();
        expect(Array.isArray(jobs)).toBe(true);
    });

    it('should add a task and track it', async () => {
        (ceRecipeService.getRecipe as jest.Mock).mockReturnValue({});

        await ceQueueService.addBulkTask('job_123', 'prof_1', 'rec_1', ['http://test.com/cat1'], { ignore_facets: false });

        const jobs = ceQueueService.getActiveJobs();
        expect(jobs.length).toBeGreaterThan(0);
        expect(jobs[0].id).toBe('job_123');
        expect(jobs[0].status).toBe('running');
    });

    it('should pause and resume queue', () => {
        const p = ceQueueService.pauseQueue();
        expect(p.success).toBe(true);
        let jobs = ceQueueService.getActiveJobs();
        expect(jobs[0].status).toBe('paused');

        ceQueueService.resumeQueue();
        jobs = ceQueueService.getActiveJobs();
        expect(jobs[0].status).toBe('running');
    });

    it('should stop job and wipe data', () => {
        // Mock DB delete
        const stopRes = ceQueueService.stopJob('job_123', true);
        expect(stopRes.success).toBe(true);

        const jobs = ceQueueService.getActiveJobs();
        const found = jobs.find(j => j.id === 'job_123');
        expect(found).toBeUndefined();
    });
});
