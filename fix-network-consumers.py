import os
import re

src_dir = os.path.join(os.getcwd(), 'src')

STATE_PROPS = {'upnpStatus', 'cloudTunnelStatus', 'isLanBroadcasting', 'localIp', 'publicIp', 'isLoadingNetwork'}
ACTION_PROPS = {'checkUpnpSupport', 'startUpnp', 'stopUpnp', 'startCloudTunnel', 'stopCloudTunnel', 'toggleLan', 'applyNetworkMode', 'refreshDiagnostics'}

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            if file == 'NetworkContext.tsx':
                continue
                
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if 'useNetwork' not in content:
                continue
                
            # Replace import
            content = re.sub(
                r'import\s+\{([^}]*?)useNetwork([^}]*?)\}\s+from\s+([\'"])(.*?)NetworkContext\3;?',
                r'import {\1useNetworkState, useNetworkActions\2} from \3\4NetworkContext\3;',
                content
            )
            
            # Find destructuring: const { a, b, c } = useNetwork();
            matches = re.finditer(r'const\s+\{([^}]+)\}\s*=\s*useNetwork\(\);', content)
            
            offset = 0
            for match in matches:
                vars_str = match.group(1)
                var_names = [v.strip() for v in vars_str.split(',')]
                var_names = [v for v in var_names if v]
                
                state_vars = [v for v in var_names if v.split(':')[0].strip() in STATE_PROPS]
                action_vars = [v for v in var_names if v.split(':')[0].strip() in ACTION_PROPS]
                
                replacements = []
                if state_vars:
                    replacements.append(f"const {{ {', '.join(state_vars)} }} = useNetworkState();")
                if action_vars:
                    replacements.append(f"const {{ {', '.join(action_vars)} }} = useNetworkActions();")
                    
                replacement = '\n  '.join(replacements)
                
                # Replace in content string
                start = match.start() + offset
                end = match.end() + offset
                
                content = content[:start] + replacement + content[end:]
                offset += len(replacement) - (end - start)
                
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
                
print('Done replacing useNetwork')
