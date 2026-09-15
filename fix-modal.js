const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/components/modals/CreateServerModal.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

if (!content.includes('import { X } from "lucide-react"')) {
    content = content.replace(
        /import React(.*);\n/,
        "import React;\nimport { X } from \"lucide-react\";\n"
    );
}

content = content.replace(
    /<button\s+onClick=\{onClose\}[\s\S]*?disabled=\{isCreating \|\| isDownloading\}[\s\S]*?className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white\/5 transition disabled:opacity-30"[\s\S]*?>[\s\S]*?<\/button>/m,
    <button
            onClick={onClose}
            disabled={isCreating || isDownloading}
            className="text-content-secondary hover:text-content-primary p-1 rounded-lg hover:bg-surface-hover transition disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
);

content = content.replace(/text-white/g, 'text-content-primary');
content = content.replace(/text-slate-200/g, 'text-content-primary');
content = content.replace(/text-slate-300/g, 'text-content-primary');
content = content.replace(/text-slate-400/g, 'text-content-secondary');
content = content.replace(/border-white\/10/g, 'border-border-default');
content = content.replace(/border-white\/5/g, 'border-border-subtle');
content = content.replace(/bg-white\/5/g, 'bg-surface-hover');
content = content.replace(/glass-panel/g, 'bg-surface-elevated');
content = content.replace(/bg-black\/80/g, 'bg-black/60');
content = content.replace(/bg-surface-base\/60/g, 'bg-surface-base');
content = content.replace(/bg-surface-base\/80/g, 'bg-surface-base');

content = content.replace(/bg-success text-content-primary/g, 'bg-success text-surface-base');
content = content.replace(/bg-success hover:bg-success\/80 text-content-primary/g, 'bg-success hover:bg-success/80 text-surface-base');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed CreateServerModal.tsx');
