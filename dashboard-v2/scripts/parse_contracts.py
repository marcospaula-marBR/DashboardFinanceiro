import os
import json
import re
import argparse
import requests

try:
    import pdfplumber
except ImportError:
    print("A biblioteca 'pdfplumber' é necessária.")
    print("Por favor, instale usando: pip install pdfplumber requests")
    exit(1)

def buscar_cep(cep):
    """
    Busca o endereço completo na API do ViaCEP a partir de um CEP.
    """
    cep_limpo = re.sub(r'\D', '', cep)
    if len(cep_limpo) != 8:
        return None
    try:
        response = requests.get(f"https://viacep.com.br/ws/{cep_limpo}/json/", timeout=5)
        if response.status_code == 200:
            dados = response.json()
            if "erro" not in dados:
                return f"{dados.get('logradouro', '')}, {dados.get('bairro', '')}, {dados.get('localidade', '')} - {dados.get('uf', '')}, CEP: {dados.get('cep', '')}"
    except Exception as e:
        print(f"Erro ao buscar CEP {cep}: {e}")
    return None

def extract_data_from_text(text):
    """
    Extrai informações do texto do contrato usando Expressões Regulares (Regex).
    Nota: Esses padrões podem precisar de ajustes finos baseados nos contratos reais da sua empresa.
    """
    data = {
        "regime": "PJ",
        "metadata": {} # Para salvar campos dinâmicos futuramente
    }
    
    # 1. CNPJ da Contratada (Formato XX.XXX.XXX/XXXX-XX)
    cnpj_match = re.search(r'CNPJ[\s:]*([0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2})', text, re.IGNORECASE)
    if cnpj_match:
        data["pj_cnpj"] = cnpj_match.group(1)
        
    # 2. CPF do Responsável (Formato XXX.XXX.XXX-XX)
    cpf_match = re.search(r'CPF[\s:]*([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})', text, re.IGNORECASE)
    if cpf_match:
        data["responsible_cpf"] = cpf_match.group(1)
        
    # 3. Extração de CEP e Busca Automática
    # Procura por padrões de CEP (XXXXX-XXX)
    ceps = re.findall(r'CEP[\s:]*([0-9]{5}-?[0-9]{3})', text, re.IGNORECASE)
    if ceps:
        # Pega o primeiro CEP encontrado e enriquece via API
        cep_encontrado = ceps[0]
        endereco_completo = buscar_cep(cep_encontrado)
        if endereco_completo:
            data["pj_endereco_completo"] = endereco_completo
        else:
            data["pj_endereco_completo"] = f"CEP: {cep_encontrado}"
            
    # 4. Valor Base do Contrato (Procura R$ 1.500,00)
    valor_match = re.search(r'R\$[\s]*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})', text)
    if valor_match:
        val_str = valor_match.group(1).replace('.', '').replace(',', '.')
        data["remuneration_base"] = float(val_str)
        
    # 5. E-mail
    email_match = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', text)
    if email_match:
        data["email_pessoal"] = email_match.group(1)
        
    return data

def parse_pdf(file_path):
    text = ""
    # Abre o PDF e extrai o texto de todas as páginas
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            pagina_texto = page.extract_text()
            if pagina_texto:
                text += pagina_texto + "\n"
    
    # Processa o texto extraído
    return extract_data_from_text(text)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extrator Inteligente de Contratos PJ")
    parser.add_argument("pdf_path", help="Caminho para o arquivo PDF do contrato")
    args = parser.parse_args()
    
    if not os.path.exists(args.pdf_path):
        print(f"Erro: Arquivo não encontrado - {args.pdf_path}")
        exit(1)
        
    print(f"Iniciando leitura do arquivo: {args.pdf_path}...")
    try:
        resultado = parse_pdf(args.pdf_path)
        print("\n=== DADOS EXTRAÍDOS COM SUCESSO ===")
        print(json.dumps(resultado, indent=4, ensure_ascii=False))
        print("===================================\n")
    except Exception as e:
        print(f"Ocorreu um erro durante a leitura do PDF: {e}")
