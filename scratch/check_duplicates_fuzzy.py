import urllib.request
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def http(method, path, body=None):
    url = SUPABASE_URL + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            return r.status, json.loads(text) if text else []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        return e.code, err

def clean_doc(doc):
    if not doc: return ""
    return "".join(c for c in str(doc) if c.isdigit())

def clean_name(name):
    if not name: return ""
    return " ".join(str(name).strip().upper().split())

def main():
    status, emps = http("GET", "/rest/v1/employees?select=*")
    if status != 200:
        print("Error:", emps)
        return

    # Check for same PIX Key
    by_pix = {}
    for e in emps:
        raw_pix = e.get('pix_key') or ""
        pix = clean_doc(raw_pix) or raw_pix.strip().lower()
        if pix and len(pix) > 3:
            if pix not in by_pix: by_pix[pix] = []
            by_pix[pix].append(e)
    
    dup_pix = {k: v for k, v in by_pix.items() if len(v) > 1}
    print(f"\nDuplicates by PIX Key: {len(dup_pix)}")
    for pix, records in dup_pix.items():
        print(f"  - PIX Key: '{pix}'")
        for r in records:
            print(f"    ID: {r['id']} | Nome: '{r['full_name']}' | Doc: {r['document_id']} | Empresa: {r['company']}")

    # Check for same responsible_cpf or responsible_name
    by_resp_cpf = {}
    for e in emps:
        rcpf = clean_doc(e.get('responsible_cpf'))
        if rcpf:
            if rcpf not in by_resp_cpf: by_resp_cpf[rcpf] = []
            by_resp_cpf[rcpf].append(e)

    dup_rcpf = {k: v for k, v in by_resp_cpf.items() if len(v) > 1}
    print(f"\nDuplicates by Responsible CPF: {len(dup_rcpf)}")
    for cpf, records in dup_rcpf.items():
        print(f"  - CPF Sócio: '{cpf}'")
        for r in records:
            print(f"    ID: {r['id']} | Nome: '{r['full_name']}' | Doc: {r['document_id']} | Empresa: {r['company']}")

    # Check for name similarity (first name + last name)
    by_first_last = {}
    for e in emps:
        parts = clean_name(e.get('full_name')).split()
        if len(parts) >= 2:
            key = (parts[0], parts[-1])
            if key not in by_first_last: by_first_last[key] = []
            by_first_last[key].append(e)
    
    dup_fl = {k: v for k, v in by_first_last.items() if len(v) > 1}
    print(f"\nDuplicates by First + Last Name: {len(dup_fl)}")
    for key, records in dup_fl.items():
        # Filter out PJ entities that might match (e.g. LTDA, MEI in name)
        names = [r['full_name'] for r in records]
        print(f"  - Key: {key}")
        for r in records:
            print(f"    ID: {r['id']} | Nome: '{r['full_name']}' | Doc: {r['document_id']} | Empresa: {r['company']}")

if __name__ == "__main__":
    main()
