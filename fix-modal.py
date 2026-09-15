import os
import re

file_path = os.path.join(os.getcwd(), 'src', 'components', 'modals', 'CreateServerModal.tsx')
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'import { X } from "lucide-react"' not in content and 'import { X } from \'lucide-react\'' not in content:
    content = re.sub(
        r'(import React.*?\n)',
        r'\1import { X } from "lucide-react";\n',
        content,
        count=1
    )

close_btn_pattern = r'<button\s+onClick=\{onClose\}[^>]*?className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition disabled:opacity-30"[^>]*?>\s*</button>'
close_btn_replacement = '''<button
            onClick={onClose}
            disabled={isCreating || isDownloading}
            className="text-content-secondary hover:text-content-primary p-1 rounded-lg hover:bg-surface-hover transition disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>'''

content = re.sub(close_btn_pattern, close_btn_replacement, content, flags=re.MULTILINE)

content = content.replace('text-white', 'text-content-primary')
content = content.replace('text-slate-200', 'text-content-primary')
content = content.replace('text-slate-300', 'text-content-primary')
content = content.replace('text-slate-400', 'text-content-secondary')
content = content.replace('border-white/10', 'border-border-default')
content = content.replace('border-white/5', 'border-border-subtle')
content = content.replace('bg-white/5', 'bg-surface-hover')
content = content.replace('glass-panel', 'bg-surface-elevated')
content = content.replace('bg-black/80', 'bg-black/60')
content = content.replace('bg-surface-base/60', 'bg-surface-base')
content = content.replace('bg-surface-base/80', 'bg-surface-base')

content = content.replace('bg-success text-content-primary', 'bg-success text-surface-base')
content = content.replace('bg-success hover:bg-success/80 text-content-primary', 'bg-success hover:bg-success/80 text-surface-base')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed CreateServerModal.tsx using Python')
