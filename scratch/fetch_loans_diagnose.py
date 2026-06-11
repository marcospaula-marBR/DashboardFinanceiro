import urllib.request
import json
import sys

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def run_diagnose():
    # Fetch all employees
    try:
        req_emp = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/employees?select=id,full_name,status",
            headers=HEADERS,
            method="GET"
        )
        with urllib.request.urlopen(req_emp) as resp:
            employees = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching employees: {e}")
        return

    emp_map = {emp['id']: emp for emp in employees}

    # Fetch all loans
    try:
        req_loans = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/employee_loans?select=id,employee_id,amount,installments,start_cycle,amount_paid_extra,postponed_months,notes,request_date",
            headers=HEADERS,
            method="GET"
        )
        with urllib.request.urlopen(req_loans) as resp:
            loans = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching loans: {e}")
        return

    print(f"Total employees: {len(employees)}")
    print(f"Total loans: {len(loans)}")
    print("\n--- LOANS LIST ---")
    for idx, loan in enumerate(loans):
        emp_id = loan.get('employee_id')
        emp = emp_map.get(emp_id, {})
        emp_name = emp.get('full_name', 'Unknown')
        
        # Safely print ASCII values
        print(f"\nLoan #{idx+1}:")
        print(f"  ID: {loan.get('id')}")
        print(f"  Employee ID: {emp_id} ({emp_name})")
        print(f"  Amount: R$ {loan.get('amount')}")
        print(f"  Installments: {loan.get('installments')}")
        print(f"  Start Cycle: {loan.get('start_cycle')}")
        print(f"  Amount Paid Extra: {loan.get('amount_paid_extra')}")
        print(f"  Postponed Months: {loan.get('postponed_months')}")
        print(f"  Request Date: {loan.get('request_date')}")
        notes_ascii = str(loan.get('notes', '')).encode('ascii', 'replace').decode()
        print(f"  Notes: {notes_ascii}")

if __name__ == '__main__':
    # Ensure stdout uses UTF-8 to prevent cp1252 errors on Windows console
    if sys.stdout.encoding != 'utf-8':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    run_diagnose()
