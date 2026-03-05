import 'dotenv/config';
import { Orchestrator } from '../lib/orchestrator/orchestrator';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

// V26 Infrastructure Hardening: Persistent Background Queue Worker
// This daemon runs independently from the Next.js UI request lifecycle,
// ensuring the ActionQueue is always processed and leased safely without SQLite locking constraints.

const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds

let isRunning = true;

async function startWorker() {
    logger.info({ action: 'WorkerStarted', message: 'ActionQueue background worker initialized' });

    while (isRunning) {
        try {
            // Execute the queue processing cycle
            // processQueue locks pending actions (via leased lock) and processes them securely
            const orgs = await prisma.organization.findMany({ select: { id: true } });
            for (const org of orgs) {
                await Orchestrator.processQueue(org.id);
            }
        } catch (error: any) {
            logger.error({ action: 'WorkerCycleFailed', error: error.message });
        }

        // Wait before polling again, but break early if shutting down
        for (let i = 0; i < POLL_INTERVAL_MS / 1000; i++) {
            if (!isRunning) break;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    logger.info({ action: 'WorkerShutdown', message: 'Worker exited cleanly' });
    process.exit(0);
}

// Graceful shutdown handlers to ensure locks aren't permanently orphaned if the process dies
function handleShutdown(signal: string) {
    logger.info({ action: 'WorkerShutdownSignal', signal, message: 'Initiating graceful shutdown...' });
    isRunning = false;
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startWorker();
