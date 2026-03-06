const fs = require('fs');
const path = require('path');

function fix(dir) {
    for (let f of fs.readdirSync(dir)) {
        let p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) fix(p);
        else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
            let c = fs.readFileSync(p, 'utf8');
            if (c.includes('const {  } = await params;')) {
                let vars = [];
                if (p.includes('[slug]')) vars.push('slug');
                if (p.includes('[id]')) vars.push('id');
                if (p.includes('[repId]')) vars.push('repId');
                if (p.includes('[seqId]')) vars.push('seqId');
                if (p.includes('[approvalId]')) vars.push('approvalId');
                if (p.includes('[packetId]')) vars.push('packetId');
                if (p.includes('[msgId]')) vars.push('msgId');

                // Custom fallbacks if somehow it missed
                if (vars.length === 0) vars.push('slug');

                let str = vars.join(', ');
                let n = c.replace(/const \{  \} = await params;/g, `const { ${str} } = await params;`);
                fs.writeFileSync(p, n);
                console.log('Fixed', p, 'with', str);
            }
        }
    }
}
fix('app');
