#!/usr/bin/env python3
"""
Servidor HTTP simples para o app DRE Mar Brasil
Execute este arquivo para rodar o app localmente
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Adiciona headers para permitir CORS se necessário
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def main():
    # Muda para o diretório do script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    Handler = MyHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print(f"🚀 Servidor DRE Mar Brasil iniciado!")
        print(f"📍 Acesse: {url}")
        print(f"🛑 Pressione Ctrl+C para parar o servidor")
        print("=" * 60)
        
        # Abre o navegador automaticamente
        webbrowser.open(url)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n✅ Servidor encerrado com sucesso!")

if __name__ == "__main__":
    main()
