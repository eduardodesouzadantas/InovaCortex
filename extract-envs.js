const fs = require('fs');
const path = require('path');

const envs = new Set();
const regex = /process\.env\.([A-Z0-9_]+)/g;

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
                walk(fullPath);
            }
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            let match;
            while ((match = regex.exec(content)) !== null) {
                envs.add(match[1]);
            }
        }
    }
}

walk(path.join(__dirname, 'app'));
walk(path.join(__dirname, 'lib'));
walk(path.join(__dirname, 'components'));
walk(path.join(__dirname, 'scripts'));
walk(path.join(__dirname, 'prisma')); // seed files etc
walk(__dirname); // root config files like next.config.ts

console.log(Array.from(envs).sort().join('\n'));
