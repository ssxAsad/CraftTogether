import os
import re

src_dir = os.path.join(os.getcwd(), 'src')

STATE_PROPS = {'servers', 'activeServer', 'isLoadingServers', 'status', 'metrics', 'players', 'logs', 'javaRuntimes', 'isDownloading', 'downloadProgress'}
ACTION_PROPS = {'startServer', 'stopServer', 'killServer', 'sendCommand', 'createServer', 'updateServerConfig', 'deleteServer', 'selectServer', 'clearLogs', 'refreshServers'}

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            if file == 'ServerContext.tsx':
                continue
                
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if 'useServer' not in content:
                continue
                
            # Replace import
            content = re.sub(
                r'import\s+\{([^}]*?)useServer([^}]*?)\}\s+from\s+([\'"])(.*?)ServerContext\3;?',
                r'import {\1useServerState, useServerActions\2} from \3\4ServerContext\3;',
                content
            )
            
            # Find destructuring: const { a, b, c } = useServer();
            matches = re.finditer(r'const\s+\{([^}]+)\}\s*=\s*useServer\(\);', content)
            
            offset = 0
            for match in matches:
                vars_str = match.group(1)
                var_names = [v.strip() for v in vars_str.split(',')]
                var_names = [v for v in var_names if v]
                
                state_vars = [v for v in var_names if v.split(':')[0].strip() in STATE_PROPS]
                action_vars = [v for v in var_names if v.split(':')[0].strip() in ACTION_PROPS]
                
                replacements = []
                if state_vars:
                    replacements.append(f"const {{ {', '.join(state_vars)} }} = useServerState();")
                if action_vars:
                    replacements.append(f"const {{ {', '.join(action_vars)} }} = useServerActions();")
                    
                replacement = '\n  '.join(replacements)
                
                # Replace in content string
                start = match.start() + offset
                end = match.end() + offset
                
                content = content[:start] + replacement + content[end:]
                offset += len(replacement) - (end - start)
                
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
                
print('Done replacing useServer')
