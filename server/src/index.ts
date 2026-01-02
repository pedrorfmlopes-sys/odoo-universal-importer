import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createExpressApp } from './server';
import { initPuppeteerService } from './modules/catalogEnricher/services/cePuppeteerService';

const PORT = process.env.PORT || 4000;
const app = createExpressApp();
console.log(`[System] Server Starting at ${new Date().toISOString()}...`); // FORCE RESTART 2025-12-25 01:14 (Job Monitor UI)

// Create HTTP server to allow Socket.IO attachment
const server = http.createServer(app);

// Initialize Socket.IO
export const io = new SocketIOServer(server, {
    cors: {
        origin: "*", // Allow React Client
        methods: ["GET", "POST"]
    }
});

// Setup Socket Events
io.on('connection', (socket) => {
    console.log('🔌 Client connected to Socket.IO', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
    });

    // Listen for Teacher Commands from Frontend
    socket.on('teacher:action', async (data) => {
        const { executeTeacherAction, startTeacherBrowser } = await import('./modules/catalogEnricher/services/cePuppeteerService');

        if (data.action === 'STOP_SESSION') {
            // We can just reuse startTeacherBrowser to close, or better expose a close function.
            // For now let's hack it by calling startTeacherBrowser with empty/special?
            // No, let's expose closeTeacherBrowser in service.
            const { closeTeacherBrowser } = await import('./modules/catalogEnricher/services/cePuppeteerService');
            if (closeTeacherBrowser) await closeTeacherBrowser();
        } else if (data.action === 'REPLAY_RECIPE') {
            const { replayRecipe } = await import('./modules/catalogEnricher/services/cePuppeteerService');
            if (replayRecipe) {
                try {
                    const results = await replayRecipe(data.steps, data.url);
                    socket.emit('teacher:replay_result', results);
                } catch (e: any) {
                    socket.emit('teacher:replay_error', e.message);
                }
            }

        } else {
            await executeTeacherAction(data.action, data);
        }
    });
});

// Pass IO instance to Puppeteer Service
// Pass IO instance to Puppeteer Service
initPuppeteerService(io);
// Pass IO instance to Queue Service
import { initQueueService } from './modules/catalogEnricher/services/ceQueueService';
initQueueService(io);
// Pass IO instance to Job Service
import { initJobService } from './modules/catalogEnricher/services/ceJobService';
initJobService(io);

server.listen(PORT, () => {
    console.log(`🚀 API & Socket listening on http://localhost:${PORT}`);
});
