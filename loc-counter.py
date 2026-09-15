import os

src_dir = os.path.join(os.getcwd(), 'src')

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            size = os.path.getsize(path)
            with open(path, 'r', encoding='utf-8') as f:
                lines = len(f.readlines())
            print(f"{os.path.relpath(path, src_dir)}: {lines} lines, {size} bytes")
