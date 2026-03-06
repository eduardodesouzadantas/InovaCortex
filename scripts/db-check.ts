import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

async function checkDeployment() {
    logger.info('Running deployment pre-flight checks...');

    let hasErrors = false;

    // 1. Check Database
    try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info('✅ Database connection successful');
    } catch (e: any) {
        logger.error(`❌ Database connection failed: ${e.message}`);
        hasErrors = true;
    }

    // 2. Check S3 Env Vars
    if (process.env.UPLOAD_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        logger.info('✅ S3 Storage credentials detected');
    } else {
        logger.warn('⚠️ S3 Storage credentials missing. File uploads will fallback to local stub storage.');
    }

    // 3. Check Autopilot Env
    if (process.env.AI_AUTOPILOT_BUILDER === 'true') {
        logger.info('✅ Builder Autopilot is ENABLED');
    }

    if (hasErrors) {
        logger.error('Deployment checks failed!');
        process.exit(1);
    } else {
        logger.info('All critical deployment checks passed.');
        process.exit(0);
    }
}

checkDeployment();
