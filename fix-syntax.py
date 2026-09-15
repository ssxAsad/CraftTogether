import os
import re

file_path = os.path.join(os.getcwd(), 'src', 'context', 'ServerContext.tsx')
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace missing useCallback endings safely
# 1. startServer
content = re.sub(
    r'(setTimeout\(\(\) => \{\s*setStatus\(\'ONLINE\'\);\s*setLogs\(prev => \[\.\.\.prev, \{ line: \'\[Craftora Mock\] Server is ONLINE and accepting connections! ✨\', type: \'system\' \}\]\);\s*\}, 1500\);\s*return true;\s*)\};',
    r'\1}, [activeServer]);', content)
# 2. stopServer
content = re.sub(
    r'(setTimeout\(\(\) => setStatus\(\'STOPPED\'\), 1000\);\s*return true;\s*)\};',
    r'\1}, []);', content)
# 3. killServer
content = re.sub(
    r'(setStatus\(\'STOPPED\'\);\s*return true;\s*)\};',
    r'\1}, []);', content)
# 4. sendCommand
content = re.sub(
    r'(setLogs\(prev => \[\.\.\.prev, \{ line: > \$\{cmd\}, type: \'system\' \}\]\);\s*return true;\s*)\};',
    r'\1}, []);', content)
# 5. createServer
content = re.sub(
    r'(localStorage\.setItem\(\'craftora_active_server_id\', cleanId\);\s*setIsDownloading\(false\);\s*\}, 1500\);\s*\}\s*)\};',
    r'\1}, [refreshServers]);', content)
# 6. updateServerConfig
content = re.sub(
    r'(setActiveServer\(prev => prev && prev\.id === serverId \? \{ \.\.\.prev, \.\.\.partial \} : prev\);\s*)\};',
    r'\1}, []);', content)
# 7. deleteServer
content = re.sub(
    r'(await refreshServers\(\);\s*return true;\s*)\};',
    r'\1}, [status, activeServer, servers, refreshServers]);', content)
# 8. selectServer
content = re.sub(
    r'(localStorage\.setItem\(\'craftora_active_server_id\', server\.id\);\s*setLogs\(\[\]\);\s*)\};',
    r'\1}, [status, activeServer]);', content)
# 9. clearLogs
content = re.sub(
    r'(setLogs\(\[\]\);\s*)\};',
    r'\1}, []);', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Syntax fixed')
