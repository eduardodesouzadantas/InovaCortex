const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;

            // 1. interface Params { params: { ... } } -> interface Params { params: Promise<{ ... }> }
            // Avoid matching if already Promise
            if (content.includes('interface Params { params: {')) {
                content = content.replace(/interface Params \{ params: \{([^}]+)\} \}/g, 'interface Params { params: Promise<{$1}> }');
                changed = true;
            }

            // 2. Inline type: { params }: { params: { slug: string } }
            const regex = /\{ params \}: \{ params: \{([^}]+)\} \}/g;
            if (regex.test(content) && !content.match(/Promise<\{([^}]+)\}>/)) {
                content = content.replace(regex, '{ params }: { params: Promise<{$1}> }');
                changed = true;
            }

            // Add `await params` resolution
            if (changed && !content.includes('await params;')) {
                content = content.replace(/(export async function \w+\((?:[^)]+)?(?:req|request|_req)[^)]*, \{ params \}[^)]*\) \{)/g, '$1\n    const resolvedParams = await params;');
                content = content.replace(/params\.slug/g, 'resolvedParams.slug');
                content = content.replace(/params\.id/g, 'resolvedParams.id');
                content = content.replace(/params\.repId/g, 'resolvedParams.repId');
                content = content.replace(/params\.seqId/g, 'resolvedParams.seqId');
                content = content.replace(/params\.msgId/g, 'resolvedParams.msgId');
                content = content.replace(/params\.approvalId/g, 'resolvedParams.approvalId');
                content = content.replace(/params\.packetId/g, 'resolvedParams.packetId');
            }

            // Also clean up my previous manual fixes that might have left params destructured but no Promise
            // Specifically `const { slug } = await params;` where interface was fixed.
            // E.g. replace `const { slug } = params;` with await params
            if (content.includes('const { id } = params;') && content.includes('Promise<{')) {
                content = content.replace('const { id } = params;', 'const { id } = await params;');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed:', fullPath);
            }
        }
    }
}

processDir(path.join(process.cwd(), 'app', 'api'));
