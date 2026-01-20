import re
import os

version_file = 'version.js'

def bump_version():
    if not os.path.exists(version_file):
        with open(version_file, 'w', encoding='utf-8') as f:
            f.write('window.APP_VERSION = "11.1";')
        print("Criado version.js com v11.1")
        return

    with open(version_file, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'APP_VERSION\s*=\s*"(\d+)\.(\d+)"', content)
    if match:
        major = int(match.group(1))
        minor = int(match.group(2))
        new_minor = minor + 1
        new_version = f'{major}.{new_minor}'
        new_content = re.sub(r'APP_VERSION\s*=\s*"\d+\.\d+"', f'APP_VERSION = "{new_version}"', content)
        
        with open(version_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Versão atualizada para: v{new_version}")
    else:
        print("Padrão de versão não encontrado no arquivo.")

if __name__ == "__main__":
    bump_version()
