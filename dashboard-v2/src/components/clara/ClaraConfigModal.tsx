"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Key, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  CreditCard, 
  Building2, 
  RefreshCw,
  Lock
} from "lucide-react";
import { ClaraConfig, OmieAccountOption, OmieCategoryOption, OmieDepartmentOption } from "@/types/clara.types";

interface ClaraConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ClaraConfigModal({ isOpen, onClose, onSaved }: ClaraConfigModalProps) {
  const [config, setConfig] = useState<Partial<ClaraConfig>>({});
  const [accounts, setAccounts] = useState<OmieAccountOption[]>([]);
  const [categories, setCategories] = useState<OmieCategoryOption[]>([]);
  const [departments, setDepartments] = useState<OmieDepartmentOption[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const [cfgRes, resRes] = await Promise.all([
        fetch('/api/clara/config').then(r => r.json()),
        fetch('/api/clara/omie-resources').then(r => r.json()),
      ]);

      if (cfgRes.data) setConfig(cfgRes.data);
      if (resRes.data) {
        setAccounts(resRes.data.accounts || []);
        setCategories(resRes.data.categories || []);
        setDepartments(resRes.data.departments || []);
      }
    } catch (e: any) {
      console.error('Erro ao carregar dados de configuração:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/clara/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setTestResult({
        success: data.status === 'success',
        message: data.message || (data.status === 'success' ? 'Conexão estabelecida com sucesso!' : 'Falha na conexão.'),
      });
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Erro de rede ao testar conexão.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/clara/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.status === 'success') {
        onSaved();
        onClose();
      } else {
        alert(`Erro ao salvar: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Erro de conexão ao salvar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const creditCardAccounts = accounts.filter(a => a.tipo === 'CR');

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Configurações da Integração Clara</h2>
              <p className="text-xs text-slate-500">Parâmetros de conexão mTLS e vínculo de Conta Corrente no Omie</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
            <p className="text-xs text-slate-500">Carregando configurações e contas do Omie...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            
            {/* Modo Seguro / Produção Toggle */}
            <div className={`p-4 rounded-xl border transition-all ${config.safe_mode ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className={config.safe_mode ? 'text-amber-600' : 'text-emerald-600'} />
                    <span className="text-xs font-bold text-slate-900">
                      {config.safe_mode ? 'Modo de Teste Ativo (Seguro)' : 'Modo de Produção Ativo'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-md">
                    {config.safe_mode
                      ? 'Nenhum lançamento real será criado no Omie. Transações serão importadas, mapeadas e preparadas para auditoria.'
                      : 'Transações elegíveis serão lançadas automaticamente na conta corrente selecionada do Omie com seus anexos.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, safe_mode: !config.safe_mode })}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all shadow-sm ${
                    config.safe_mode
                      ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                  }`}
                >
                  {config.safe_mode ? 'Mudar p/ Produção' : 'Mudar p/ Teste'}
                </button>
              </div>
            </div>

            {/* Seção 1: Credenciais Clara (mTLS + OAuth) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Lock size={14} className="text-slate-400" />
                  Credenciais da API Clara (Brasil)
                </h3>
                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                  3 itens gerados pela Clara
                </span>
              </div>

              {/* Item 3 da Clara: Credenciais do Cliente (JSON) */}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Key size={14} className="text-blue-600" />
                    Credenciais do Cliente (JSON)
                  </span>
                  <label className="text-[11px] font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg cursor-pointer shadow-2xs transition-all">
                    <span>📁 Carregar arquivo .json</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => {
                            try {
                              const parsed = JSON.parse(ev.target?.result as string);
                              const cid = parsed.client_id || parsed.clientId || parsed.id;
                              const csec = parsed.client_secret || parsed.clientSecret || parsed.secret;
                              let pub = parsed.publicKey || parsed.certificate || parsed.cert;
                              let priv = parsed.privateKey || parsed.privateKeyPem || parsed.key;

                              if (typeof pub === 'string' && pub.includes('\\n')) {
                                pub = pub.replace(/\\n/g, '\n');
                              }
                              if (typeof priv === 'string') {
                                if (priv.includes('\\n')) priv = priv.replace(/\\n/g, '\n');
                                if (priv.includes('nnRB/QbS7')) priv = priv.replace('nnRB/QbS7', 'nRB/QbS7');
                              }

                              setConfig(prev => ({
                                ...prev,
                                client_id: cid || prev.client_id,
                                client_secret: csec || prev.client_secret,
                                certificate_pem: pub || prev.certificate_pem,
                                private_key_pem: priv || prev.private_key_pem,
                              }));
                            } catch {
                              alert('O arquivo selecionado não é um JSON válido.');
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="text-[11px] text-blue-800/80">
                  Faça o download do JSON no painel da Clara e carregue aqui ou cole os valores nos campos abaixo:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client ID</label>
                    <input
                      type="text"
                      value={config.client_id || ''}
                      onChange={e => setConfig({ ...config, client_id: e.target.value })}
                      placeholder="clara-client-id"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Client Secret</label>
                    <input
                      type="password"
                      value={config.client_secret || ''}
                      onChange={e => setConfig({ ...config, client_secret: e.target.value })}
                      placeholder={config.client_secret ? '••••••••••••••••' : 'Inserir client secret'}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Item 1 da Clara: Chave pública */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Chave pública <span className="text-slate-400 font-normal">(Chave aberta para criptografia/verificação)</span>
                  </label>
                  <label className="text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-all">
                    <span>📁 Carregar arquivo</span>
                    <input
                      type="file"
                      accept=".crt,.pem,.pub,.txt"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => {
                            setConfig(prev => ({ ...prev, certificate_pem: ev.target?.result as string }));
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={config.certificate_pem || ''}
                  onChange={e => {
                    let val = e.target.value;
                    if (val.includes('\\n')) val = val.replace(/\\n/g, '\n');
                    setConfig({ ...config, certificate_pem: val });
                  }}
                  placeholder={config.has_certificate ? '•••••••••••••••• (Certificado público já salvo no servidor)' : '-----BEGIN CERTIFICATE----- ou -----BEGIN PUBLIC KEY-----'}
                  className="w-full px-3 py-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              {/* Item 2 da Clara: Chave privada */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Chave privada <span className="text-slate-400 font-normal">(Chave secreta para descriptografia/assinatura)</span>
                  </label>
                  <label className="text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-all">
                    <span>📁 Carregar arquivo</span>
                    <input
                      type="file"
                      accept=".key,.pem,.txt"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => {
                            let k = (ev.target?.result as string) || '';
                            if (k.includes('\\n')) k = k.replace(/\\n/g, '\n');
                            if (k.includes('nnRB/QbS7')) k = k.replace('nnRB/QbS7', 'nRB/QbS7');
                            setConfig(prev => ({ ...prev, private_key_pem: k }));
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={config.private_key_pem || ''}
                  onChange={e => {
                    let val = e.target.value;
                    if (val.includes('\\n')) val = val.replace(/\\n/g, '\n');
                    if (val.includes('nnRB/QbS7')) val = val.replace('nnRB/QbS7', 'nRB/QbS7');
                    setConfig({ ...config, private_key_pem: val });
                  }}
                  placeholder={config.has_private_key ? '•••••••••••••••• (Chave privada já salva e ativa no servidor)' : '-----BEGIN PRIVATE KEY----- ou -----BEGIN RSA PRIVATE KEY-----'}
                  className="w-full px-3 py-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all"
                >
                  {testing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  <span>Testar Conexão Clara</span>
                </button>

                {testResult && (
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md ${
                    testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Seção 2: Conta Omie da Clara */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CreditCard size={14} className="text-slate-400" />
                Vínculo com Conta Omie
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conta Corrente da Clara no Omie (Tipo CR — Cartão de Crédito)
                </label>
                <select
                  value={config.omie_n_cod_cc || ''}
                  onChange={e => {
                    const cod = Number(e.target.value);
                    const selected = accounts.find(a => a.nCodCC === cod);
                    setConfig({
                      ...config,
                      omie_n_cod_cc: cod || null,
                      omie_cc_descricao: selected?.descricao || null,
                    });
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                >
                  <option value="">Selecione a conta de cartão no Omie...</option>
                  {creditCardAccounts.length > 0 && (
                    <optgroup label="Cartões de Crédito (Recomendado - CR)">
                      {creditCardAccounts.map(a => (
                        <option key={a.nCodCC} value={a.nCodCC}>
                          {a.descricao} (Cód: {a.nCodCC})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Demais Contas">
                    {accounts.filter(a => a.tipo !== 'CR').map(a => (
                      <option key={a.nCodCC} value={a.nCodCC}>
                        {a.descricao} [{a.tipo}] (Cód: {a.nCodCC})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Os lançamentos de compras com cartão da Clara serão inseridos nesta conta via IncluirLancCC.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria Padrão (Fallback)</label>
                  <select
                    value={config.default_omie_category || ''}
                    onChange={e => setConfig({ ...config, default_omie_category: e.target.value || null })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  >
                    <option value="">Nenhuma (Exigir classificação)</option>
                    {categories.slice(0, 50).map(c => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.codigo} - {c.descricao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento Padrão (Fallback)</label>
                  <select
                    value={config.default_omie_department || ''}
                    onChange={e => setConfig({ ...config, default_omie_department: e.target.value || null })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  >
                    <option value="">Nenhum (Sem departamento)</option>
                    {departments.map(d => (
                      <option key={d.codigo} value={d.codigo}>
                        {d.descricao}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="block_unmapped"
                  checked={config.block_if_unmapped !== false}
                  onChange={e => setConfig({ ...config, block_if_unmapped: e.target.checked })}
                  className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="block_unmapped" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Bloquear envio automático de transações sem categoria mapeada (Status: MAPPING_REQUIRED)
                </label>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition-all"
              >
                {saving && <Loader2 className="animate-spin" size={14} />}
                <span>Salvar Configurações</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
