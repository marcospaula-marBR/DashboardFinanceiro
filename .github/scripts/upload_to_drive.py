#!/usr/bin/env python3
"""
Script de Upload de Backup para o Google Drive
Utiliza a Google Drive API v3 e credenciais de Service Account (JSON).
"""

import os
import sys
import json
import argparse
from pathlib import Path

def get_credentials(credentials_input=None):
    """Obtém credenciais da Service Account a partir de string JSON ou arquivo."""
    from google.oauth2 import service_account

    creds_raw = credentials_input or os.environ.get("GOOGLE_DRIVE_CREDENTIALS") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    if not creds_raw:
        raise ValueError(
            "Credenciais do Google Drive não encontradas. "
            "Configure o secret GOOGLE_DRIVE_CREDENTIALS ou a variável GOOGLE_APPLICATION_CREDENTIALS."
        )

    creds_dict = None
    # Verifica se é JSON em string
    try:
        creds_dict = json.loads(creds_raw)
    except (json.JSONDecodeError, TypeError):
        # Se não for JSON direto, tenta abrir como caminho de arquivo
        if os.path.exists(creds_raw):
            with open(creds_raw, "r", encoding="utf-8") as f:
                creds_dict = json.load(f)
        else:
            raise ValueError("As credenciais fornecidas não são um JSON válido nem um arquivo existente.")

    scopes = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]
    return service_account.Credentials.from_service_account_info(creds_dict, scopes=scopes), creds_dict.get("client_email", "desconhecido")

def upload_file_to_drive(file_path: str, folder_id: str, custom_name: str = None):
    """Faz o upload de um arquivo para uma pasta específica do Google Drive."""
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    from googleapiclient.errors import HttpError

    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado para upload: {file_path}")

    file_size_mb = path.stat().st_size / (1024 * 1024)
    file_name = custom_name or path.name

    print(f"📦 Preparando upload do arquivo: {file_name}")
    print(f"📊 Tamanho: {file_size_mb:.2f} MB ({path.stat().st_size} bytes)")

    creds, client_email = get_credentials()
    print(f"🔑 Autenticado como Service Account: {client_email}")

    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    file_metadata = {
        "name": file_name,
    }

    if folder_id and folder_id.strip():
        # Limpa possíveis prefixos como 'drive://' ou espaços
        clean_folder_id = folder_id.replace("drive://", "").strip()
        file_metadata["parents"] = [clean_folder_id]
        print(f"📁 Pasta de destino no Google Drive ID: {clean_folder_id}")
    else:
        print("⚠️  Nenhum folder_id especificado. O arquivo será criado na raiz da Service Account.")

    media = MediaFileUpload(
        str(path),
        mimetype="application/octet-stream",
        resumable=True
    )

    try:
        request = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, name, size, webViewLink",
            supportsAllDrives=True
        )

        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                print(f"⏳ Progresso do upload: {int(status.progress() * 100)}%")

        print("✅ Upload concluído com sucesso!")
        print(f"📄 Nome no Drive: {response.get('name')}")
        print(f"🆔 File ID: {response.get('id')}")
        if response.get("webViewLink"):
            print(f"🔗 Link de visualização: {response.get('webViewLink')}")

        return response

    except HttpError as err:
        print(f"\n❌ Erro na API do Google Drive: {err}")
        if err.resp.status == 404:
            print("\n💡 DICA DE CONFIGURAÇÃO:")
            print(f"A pasta com ID '{folder_id}' não foi encontrada ou não está acessível.")
            print(f"Certifique-se de COMPARTILHAR a pasta do Google Drive com o e-mail da Service Account:")
            print(f"👉 {client_email}")
            print("Conceda permissão de 'Editor' para que ela possa gravar os backups.")
        elif err.resp.status == 403:
            print("\n💡 DICA DE PERMISSÃO:")
            print(f"A Service Account ({client_email}) não tem permissão para gravar na pasta do Drive.")
            print("Compartilhe a pasta como 'Editor' com ela.")
        raise

def main():
    parser = argparse.ArgumentParser(description="Upload de arquivo para o Google Drive via Service Account")
    parser.add_argument("--file", required=True, help="Caminho do arquivo local para upload")
    parser.add_argument("--folder-id", default=os.environ.get("GOOGLE_DRIVE_FOLDER_ID", ""), help="ID da pasta de destino no Google Drive")
    parser.add_argument("--name", default=None, help="Nome personalizado do arquivo no Google Drive")
    args = parser.parse_args()

    try:
        upload_file_to_drive(file_path=args.file, folder_id=args.folder_id, custom_name=args.name)
    except Exception as e:
        print(f"❌ Falha no upload: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
