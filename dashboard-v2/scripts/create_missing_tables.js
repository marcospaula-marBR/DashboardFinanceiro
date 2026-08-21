const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'ngtjhwswbbivqajtpjvg.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS public.outsourcing_apuracao_config (
  competencia TEXT PRIMARY KEY,
  tax_input_mode TEXT DEFAULT 'rate',
  tax_rate NUMERIC(10,4) DEFAULT 5.0,
  tax_fixed NUMERIC(14,2) DEFAULT 0,
  admin_fee_mode TEXT DEFAULT 'rate',
  admin_fee_rate NUMERIC(10,4) DEFAULT 10.0,
  admin_fee_fixed NUMERIC(14,2) DEFAULT 0,
  rows_data JSONB,
  custom_columns JSONB,
  is_test BOOLEAN DEFAULT FALSE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outsourcing_repasses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia TEXT NOT NULL,
  date DATE NOT NULL,
  bank TEXT DEFAULT '',
  amount NUMERIC(14,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  is_test BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.outsourcing_apuracao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outsourcing_repasses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outsourcing_apuracao_config' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON public.outsourcing_apuracao_config FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outsourcing_repasses' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON public.outsourcing_repasses FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON public.app_settings FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;
`;

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Executando migration no Supabase...');
  try {
    const body = JSON.stringify({ query: createTablesSQL });
    const result = await makeRequest({
      hostname: SUPABASE_URL,
      path: '/pg/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY
      }
    }, body);
    
    console.log('Status /pg/query:', result.status, result.body);
  } catch (err) {
    console.error('Erro /pg/query:', err);
  }

  // Verificando tabelas via Supabase client
  const supabase = createClient('https://' + SUPABASE_URL, SERVICE_KEY);
  const tables = ['outsourcing_apuracao_config', 'outsourcing_repasses', 'app_settings', 'people_monthly_costs'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log('Tabela ' + t + ':', error ? 'ERRO: ' + error.message : 'OK');
  }
}

run();
