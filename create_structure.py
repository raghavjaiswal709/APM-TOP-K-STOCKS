

import os

def create_project_structure(root_dir, output_file):
    ignore_list = [
        'node_modules',
        '__pycache__',
        '.git',
        '.next',
        'dist',
        'build',
        'coverage',
        'package-lock.json',
        'yarn.lock',
        'npm-debug.log',
        '.DS_Store',
        'project-structure.txt',
        'create_structure.py'
    ]

    with open(output_file, 'w', encoding='utf-8') as f:
        for root, dirs, files in os.walk(root_dir):
            # Exclude ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_list]
            
            # Don't process ignored directories further
            if any(ignored in root for ignored in ignore_list):
                continue

            level = root.replace(root_dir, '').count(os.sep)
            indent = ' ' * 4 * (level)
            f.write('{}{}/\n'.format(indent, os.path.basename(root)))
            sub_indent = ' ' * 4 * (level + 1)
            for file in files:
                if file not in ignore_list:
                    f.write('{}{}\n'.format(sub_indent, file))

if __name__ == '__main__':
    create_project_structure('.', 'project-structure.txt')

