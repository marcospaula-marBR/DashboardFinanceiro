import Papa from 'papaparse';
import {
  DreRow,
  DreFilters,
  DreSimulationParams,
  DreCalculatedResult,
  DreMetadata,
  DreStructureItem
} from '@/types/dre';

const MESES_ORDEM = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Estrutura DRE inlinada — elimina dependência de fetch em produção
export const DEFAULT_DRE_ESTRUTURA: DreStructureItem[] = [
  { titulo: 'Receita Bruta de Vendas', tipo: 'linha', categorias: ['Receita Bruta de Vendas'] },
  { titulo: 'Receitas Indiretas', tipo: 'linha', categorias: ['Receitas Indiretas'] },
  { titulo: 'Total Entradas Operacionais', tipo: 'card', var: 'total_entradas' },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'Outras Receitas', tipo: 'linha', categorias: ['Outras Receitas'] },
  { titulo: 'Receitas Financeiras', tipo: 'linha', categorias: ['Receitas Financeiras'] },
  { titulo: 'Honorários', tipo: 'linha', categorias: ['Honorários'] },
  { titulo: 'Juros e Devoluções', tipo: 'linha', categorias: ['Juros e devoluções'] },
  { titulo: 'Recuperação de Despesas Variáveis', tipo: 'linha', categorias: ['Recuperação de Despesas Variáveis'] },
  { titulo: 'Outras Entradas', tipo: 'card', var: 'outras_entradas' },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'Impostos', tipo: 'linha', categorias: ['Impostos'] },
  { titulo: 'Provisão IRPJ e CSSL Trimestral', tipo: 'hidden', categorias: ['Provisão - IRPJ e CSSL Trimestral'] },
  { titulo: 'Total de Impostos', tipo: 'card', var: 'total_impostos' },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'Credenciado Operacional', tipo: 'linha', categorias: ['Credenciado Operacional', 'Adiantamento - Credenciado Operacional'] },
  { titulo: 'Terceirização de Mão de Obra', tipo: 'linha', categorias: ['Terceirização de Mão de Obra'] },
  { titulo: 'CLTs', tipo: 'linha', categorias: ['Despesas com Pessoal'] },
  { titulo: 'Custo dos Serviços Prestados', tipo: 'linha', categorias: ['Custo dos Serviços Prestados'] },
  { titulo: 'Preventiva - B2G', tipo: 'linha', categorias: ['Preventiva - B2G', 'Manutenção Preventiva'] },
  { titulo: 'Corretiva - B2G', tipo: 'linha', categorias: ['Corretiva - B2G', 'Manutenção Corretiva'] },
  { titulo: 'Outros Custos', tipo: 'linha', categorias: ['Outros Custos'] },
  { titulo: 'Total Custos Operacionais', tipo: 'card', var: 'total_custos' },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'Credenciado Administrativo', tipo: 'linha', categorias: ['Credenciado Administrativo', 'Adiantamento - Credenciado Administrativo'] },
  { titulo: 'Credenciado TI', tipo: 'linha', categorias: ['Credenciado TI', 'Adiantamento - Credenciado TI'] },
  { titulo: 'Despesas Administrativas', tipo: 'linha', categorias: ['Despesas Administrativas'] },
  { titulo: 'Despesas de Vendas e Marketing', tipo: 'linha', categorias: ['Despesas de Vendas e Marketing'] },
  { titulo: 'Despesas Financeiras', tipo: 'linha', categorias: ['Despesas Financeiras'] },
  { titulo: 'Outros Tributos', tipo: 'linha', categorias: ['Outros Tributos'] },
  { titulo: 'Despesas Eventuais', tipo: 'linha', categorias: ['Jurídico'] },
  { titulo: 'Despesas Variáveis', tipo: 'linha', categorias: ['Despesas Variáveis'] },
  { titulo: 'Intermediação de Negócios', tipo: 'hidden', categorias: ['Intermediação de Negócios'] },
  { titulo: 'Total Despesas Rateadas', tipo: 'card', var: 'total_despesas' },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'Consórcios a contemplar', tipo: 'linha', categorias: ['Consórcios - a contemplar'] },
  { titulo: 'Serviços', tipo: 'linha_calc', formula: 'servicos_menos_consorcios', categorias: ['Serviços'] },
  { titulo: 'Ativos', tipo: 'linha', categorias: ['Ativos'] },
  { titulo: 'Total Investimentos', tipo: 'card', var: 'total_investimentos' },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'Total Saídas', tipo: 'card', var: 'total_saidas' },
  { titulo: 'Lucro antes do FCL', tipo: 'card', var: 'resultado' },
  { titulo: 'Fluxo de Caixa Livre FCL', tipo: 'card', var: 'fcl' },
  { titulo: 'Lucro s/ Receita Operacional', tipo: 'card_percentual', var: 'perc_lucro' },
  { titulo: 'FCL s/ Receita Operacional', tipo: 'card_percentual', var: 'perc_fcl' },
  { titulo: 'Distribuição de Dividendos', tipo: 'hidden', var: 'dividendos', categorias: ['Distribuição de Dividendos', 'Dividendos'] },
  { titulo: 'Pessoal', tipo: 'card', var: 'pessoal', categorias: ['Despesas com Pessoal', 'Credenciado Administrativo', 'Adiantamento - Credenciado Administrativo', 'Credenciado TI', 'Adiantamento - Credenciado TI', 'Credenciado Operacional', 'Adiantamento - Credenciado Operacional'] },
  { titulo: 'Corretiva', tipo: 'card', var: 'corretiva', categorias: ['Corretiva - B2G', 'Manutenção Corretiva'] },
  { titulo: 'Preventiva', tipo: 'card', var: 'preventiva', categorias: ['Preventiva - B2G', 'Manutenção Preventiva'] },
];


const normalizeMes = (mes: string) => mes.trim().charAt(0).toUpperCase() + mes.trim().slice(1).toLowerCase();
const toTitleCase = (str: string) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());

export const DEPARTAMENTOS_MAP: Record<string, string> = {
  "Capina Eltrica / MAM / Crestani / Zasso": "Capina Elétrica / Mam / Crestani / Zasso",
  "Capina Elétrica / MAM / Crestani / Zasso": "Capina Elétrica / Mam / Crestani / Zasso",
  "Capina Eltrica / Mam / Crestani / Zasso": "Capina Elétrica / Mam / Crestani / Zasso",
  "Capina Eletrica / Mam / Crestani / Zasso": "Capina Elétrica / Mam / Crestani / Zasso",
  "Capina Elétrica / Mam / Crestani / Zasso": "Capina Elétrica / Mam / Crestani / Zasso",
  "DZM - Imveis Guilhermina": "DZM - Imóveis Guilhermina",
  "DZM - Imóveis Guilhermina": "DZM - Imóveis Guilhermina",
  "DZM - Terceirizao": "DZM - Terceirização",
  "DZM - Terceirização": "DZM - Terceirização",
  "So Paulo CMSP CSP 274/2024 03/2025": "São Paulo Cmsp Csp 274/2024 03/2025",
  "São Paulo CMSP CSP 274/2024 03/2025": "São Paulo Cmsp Csp 274/2024 03/2025",
  "So Paulo Cmsp Csp 274/2024 03/2025": "São Paulo Cmsp Csp 274/2024 03/2025",
  "São Paulo Cmsp Csp 274/2024 03/2025": "São Paulo Cmsp Csp 274/2024 03/2025"
};

export const PROJETOS_MAP: Record<string, string> = {
  "Bertioga Seduc 378/2024 (Inativo)": "Bertioga Seduc 378/2024",
  "Bertioga Seduc 378/2024": "Bertioga Seduc 378/2024",
  "Bertioga Sesap 1390/2024 71/2024 (Inativo)": "Bertioga Sesap 1390/2024 71/2024",
  "Bertioga Sesap 1390/2024 71/2024": "Bertioga Sesap 1390/2024 71/2024"
};

export const CATEGORIAS_MAP: Record<string, string> = {
  "Cursos e treinamentos (inativo)": "Cursos e treinamentos",
  "Cursos e treinamentos (inativa)": "Cursos e treinamentos",
  "Cursos e Treinamentos (inativa)": "Cursos e treinamentos",
  "Cursos e Treinamentos": "Cursos e treinamentos",
  "Honorários Jurídico": "Honorários advocatícios",
  "Honorórios advocatícios": "Honorários advocatícios",
  "Manutenção de Veículos": "Manutenção de veículos",
  "Manutenção de veiculos": "Manutenção de veículos",
  "Pedágio": "Pedágio e/ou Cobrança automática (TAG)",
  "Pedágio / TAG": "Pedágio e/ou Cobrança automática (TAG)",
  "Pedágio e/ou Cobrança automática (TAG)": "Pedágio e/ou Cobrança automática (TAG)",
  "Telefonia Móvel e/ou Fixa": "Telefonia móvel e/ou fixa",
  "Telefonia móvel e/ou fixa": "Telefonia móvel e/ou fixa",
  "Táxi e/ou Aplicativos de transporte": "Táxi e/ou aplicativos de transporte",
  "Táxi e/ou aplicativos de transporte": "Táxi e/ou aplicativos de transporte"
};

export class DreService {
  /**
   * LAYER 1: PARSING
   * Realiza a leitura e conversão robusta do CSV (ISO-8859-1 -> UTF-8 fallback)
   */
  static parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // 1. Tentar ler como UTF-8 primeiro (padrão de arquivos modernos)
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        delimiter: ";",
        complete: (results) => {
          const headerCount = results.meta.fields ? results.meta.fields.length : 0;
          // Verifica se há caracteres corrompidos óbvios (como o caractere de substituição do unicode ou Ã do Windows-1252)
          const hasCorrupted = results.meta.fields?.some(f => f.includes('\uFFFD') || f.includes('\u00C3')) || false;
          
          if (headerCount >= 3 && !hasCorrupted) {
            resolve(results.data);
            return;
          }
          
          // Fallback 1: Tentar UTF-8 com vírgula
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: "UTF-8",
            delimiter: ",",
            complete: (commaResults) => {
              const commaHeaderCount = commaResults.meta.fields ? commaResults.meta.fields.length : 0;
              const commaHasCorrupted = commaResults.meta.fields?.some(f => f.includes('\uFFFD') || f.includes('\u00C3')) || false;
              if (commaHeaderCount >= 3 && !commaHasCorrupted) {
                resolve(commaResults.data);
                return;
              }
              
              // Fallback 2: Tentar ISO-8859-1 com ponto e vírgula
              Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: "ISO-8859-1",
                delimiter: ";",
                complete: (isoResults) => {
                  const isoHeaderCount = isoResults.meta.fields ? isoResults.meta.fields.length : 0;
                  if (isoHeaderCount >= 3) {
                    resolve(isoResults.data);
                    return;
                  }
                  
                  // Fallback 3: Tentar ISO-8859-1 com vírgula
                  Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    encoding: "ISO-8859-1",
                    delimiter: ",",
                    complete: (isoCommaResults) => resolve(isoCommaResults.data),
                    error: (err) => reject(err)
                  });
                },
                error: (err) => reject(err)
              });
            },
            error: (err) => reject(err)
          });
        },
        error: (err) => reject(err)
      });
    });
  }

  /**
   * LAYER 2: NORMALIZATION
   * Padroniza colunas, filtra linhas vazias e extrai metadados estruturais
   */
  static normalizeData(rawData: any[]): { data: DreRow[], metadata: DreMetadata } {
    // 1. Detectar se o arquivo é transacional bruto (possui colunas de Data e Valor)
    const firstRow = rawData[0] || {};
    const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
    const isTransactional = keys.includes('data') && keys.includes('valor');

    if (isTransactional) {
      let colEmpresa = '';
      let colDept = '';
      let colContaDRE = '';
      let colProjeto = '';
      let colCategoria = '';
      let colData = '';
      let colValor = '';

      Object.keys(firstRow).forEach(key => {
        const cleanKey = key.trim().replace(/["']/g, '');
        const lowerKey = cleanKey.toLowerCase();
        
        // Mapeamento flexível das colunas transacionais
        if (lowerKey.includes('empresa') || lowerKey.includes('fantasia') || lowerKey.includes('razão') || lowerKey === 'empresa') {
          if (!colEmpresa || lowerKey.includes('fantasia')) {
            colEmpresa = key;
          }
        } else if (lowerKey === 'departamento' || lowerKey === 'departamento_dre' || lowerKey === 'departamento dre') {
          colDept = key;
        } else if (lowerKey === 'conta do dre' || lowerKey === 'conta dre' || lowerKey === 'contadre' || lowerKey === 'conta_dre') {
          colContaDRE = key;
        } else if (lowerKey === 'projeto') {
          colProjeto = key;
        } else if (lowerKey === 'categoria') {
          colCategoria = key;
        } else if (lowerKey === 'data' || lowerKey === 'data (completa)') {
          if (!colData || lowerKey === 'data') colData = key;
        } else if (lowerKey === 'valor') {
          colValor = key;
        }
      });

      // Agrupar as transações e pivotear
      const pivotMap = new Map<string, {
        Empresa: string;
        Departamento: string;
        ContaDRE: string;
        Projeto: string;
        Categoria: string;
        valores: Record<string, number>;
      }>();

      const MESES_ORDEM = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      rawData.forEach(row => {
        const dataStr = colData ? row[colData]?.toString().trim() : '';
        const valorStr = colValor ? row[colValor]?.toString().trim() : '0';
        if (!dataStr) return;

        // Parse do valor (converte formato brasileiro ex: -1065,5 ou -1.065,50 para float)
        // Usamos Math.abs para forçar valores positivos absolutos (as saídas vêm negativas no CSV bruto),
        // mantendo a compatibilidade com a estrutura de cálculos e KPIs do dashboard que realiza as subtrações.
        const valor = Math.abs(parseFloat(valorStr.replace(/\./g, '').replace(',', '.')));
        if (isNaN(valor)) return;

        // Parse da data (Suporta MM/DD/YYYY padrão Omie ou DD/MM/YYYY padrão brasileiro)
        let mesLabel = '';
        const partes = dataStr.split('/');
        if (partes.length === 3) {
          let mes = parseInt(partes[0]);
          let dia = parseInt(partes[1]);
          let anoCompleto = partes[2].trim().split(' ')[0]; // Remove qualquer componente de hora (ex: "2026 00:00" -> "2026")
          
          // Se o primeiro elemento for maior que 12, significa que é o dia (formato DD/MM/YYYY), então invertemos
          if (mes > 12) {
            const temp = mes;
            mes = dia;
            dia = temp;
          }
          
          if (mes >= 1 && mes <= 12) {
            const mesNome = MESES_ORDEM[mes - 1];
            // Garante ano de 2 dígitos (ex: "2026" -> "26", ou se já for "26", mantém "26")
            const anoCurto = anoCompleto.length === 4 ? anoCompleto.slice(-2) : anoCompleto;
            mesLabel = `${mesNome}/${anoCurto}`;
          }
        } else {
          const d = new Date(dataStr);
          if (!isNaN(d.getTime())) {
            const mesNome = MESES_ORDEM[d.getMonth()];
            const anoCurto = d.getFullYear().toString().slice(-2);
            mesLabel = `${mesNome}/${anoCurto}`;
          }
        }

        if (!mesLabel) return;

        const emp = colEmpresa ? row[colEmpresa]?.toString().trim() : 'Geral';
        const dep = colDept ? row[colDept]?.toString().trim() : 'Sem Departamento';
        const cDre = colContaDRE ? row[colContaDRE]?.toString().trim() : 'Sem Conta DRE';
        const proj = colProjeto ? row[colProjeto]?.toString().trim() : 'Sem Projeto';
        const cat = colCategoria ? row[colCategoria]?.toString().trim() : 'Sem Categoria';

        const groupKey = `${emp || 'Geral'}|${dep || 'Sem Departamento'}|${cDre || 'Sem Conta DRE'}|${proj || 'Sem Projeto'}|${cat || 'Sem Categoria'}`;

        if (!pivotMap.has(groupKey)) {
          pivotMap.set(groupKey, {
            Empresa: emp || 'Geral',
            Departamento: dep || 'Sem Departamento',
            ContaDRE: cDre || 'Sem Conta DRE',
            Projeto: proj || 'Sem Projeto',
            Categoria: cat || 'Sem Categoria',
            valores: {}
          });
        }

        const item = pivotMap.get(groupKey)!;
        item.valores[mesLabel] = (item.valores[mesLabel] || 0) + valor;
      });

      const dataPivoteada: any[] = [];
      pivotMap.forEach(item => {
        const rowObj: any = {
          Empresa: item.Empresa,
          Departamento: item.Departamento,
          ContaDRE: item.ContaDRE,
          Projeto: item.Projeto,
          Categoria: item.Categoria
        };
        Object.keys(item.valores).forEach(mes => {
          rowObj[mes] = Math.round(item.valores[mes] * 100) / 100;
        });
        dataPivoteada.push(rowObj);
      });

      rawData = dataPivoteada;
    }

    let data = rawData.map(row => {
      const newRow: any = {};
      Object.keys(row).forEach(key => {
        const cleanKey = key.trim().replace(/["']/g, '');
        if (!cleanKey) return;

        const lowerKey = cleanKey.toLowerCase();
        let finalKey = cleanKey;

        // Mapeamento flexível com prioridade
        if (lowerKey === 'empresa' || lowerKey.includes('minha empresa (nome fantasia)') || lowerKey.includes('minha empresa (razão social)')) {
          finalKey = 'Empresa';
        } else if (lowerKey === 'departamento' || lowerKey === 'departamento_dre' || lowerKey === 'departamento dre') {
          finalKey = 'Departamento';
        } else if (lowerKey === 'conta do dre' || lowerKey === 'conta dre' || lowerKey === 'contadre' || lowerKey === 'conta_dre') {
          finalKey = 'ContaDRE';
        } else if (lowerKey === 'projeto') {
          finalKey = 'Projeto';
        } else if (lowerKey === 'categoria') {
          finalKey = 'Categoria';
        }

        newRow[finalKey] = row[key];
      });
      return newRow;
    });

    // Retrocompatibilidade: Se vier planilha antiga com 'Projeto' e 'Categoria' originais,
    // nós os movemos para 'Departamento' e 'ContaDRE' para não quebrar.
    data.forEach(row => {
      if (!row.Departamento && row.Projeto) {
        row.Departamento = row.Projeto;
        row.Projeto = 'Sem Projeto';
      }
      if (!row.ContaDRE && row.Categoria) {
        row.ContaDRE = row.Categoria;
        row.Categoria = 'Sem Categoria';
      }

      // Preenchimento de valores padrões caso venham nulos
      if (!row.Empresa) row.Empresa = 'Geral';
      if (!row.Departamento) row.Departamento = 'Sem Departamento';
      if (!row.ContaDRE) row.ContaDRE = 'Sem Conta DRE';
      if (!row.Projeto) row.Projeto = 'Sem Projeto';
      if (!row.Categoria) row.Categoria = 'Sem Categoria';
    });

    // Filtrar apenas linhas que possuem dados válidos de Departamento e ContaDRE (Empresa é opcional)
    data = data.filter(row =>
      row['Departamento'] && row['Departamento'].toString().trim() !== '' && 
      row['ContaDRE'] && row['ContaDRE'].toString().trim() !== ''
    );

    data.forEach(row => {
      row['Empresa'] = row['Empresa'] ? row['Empresa'].toString().trim() : 'Geral';
      
      const rawDept = row['Departamento'] ? row['Departamento'].toString().trim() : 'Sem Departamento';
      const mappedDept = DEPARTAMENTOS_MAP[rawDept] || DEPARTAMENTOS_MAP[toTitleCase(rawDept)] || rawDept;
      row['Departamento'] = toTitleCase(mappedDept);
      
      row['ContaDRE'] = row['ContaDRE'].toString().trim().replace(/^\d+\.\s*/, '');
      
      const rawProj = row['Projeto'] ? row['Projeto'].toString().trim() : 'Sem Projeto';
      const mappedProj = PROJETOS_MAP[rawProj] || PROJETOS_MAP[toTitleCase(rawProj)] || rawProj;
      row['Projeto'] = toTitleCase(mappedProj);
      
      const rawCat = row['Categoria'] ? row['Categoria'].toString().trim() : 'Sem Categoria';
      row['Categoria'] = CATEGORIAS_MAP[rawCat] || rawCat;
    });

    // Coleta todas as chaves de meses únicas existentes em todas as linhas da tabela
    const allKeysSet = new Set<string>();
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key.includes('/')) {
          allKeysSet.add(key);
        }
      });
    });
    const validCols = Array.from(allKeysSet);

    const periodos: { col: string, mes: string, ano: string, full: string }[] = [];
    const mapaMeses: Record<string, string> = {};

    validCols.forEach(col => {
      const partes = col.split('/');
      if (partes.length === 2) {
        const mesNormalizado = normalizeMes(partes[0].trim());
        mapaMeses[col] = mesNormalizado;
        periodos.push({ col, mes: mesNormalizado, ano: partes[1].trim(), full: col });
      }
    });

    periodos.sort((a, b) => {
      const yA = parseInt(a.ano) < 100 ? 2000 + parseInt(a.ano) : parseInt(a.ano);
      const yB = parseInt(b.ano) < 100 ? 2000 + parseInt(b.ano) : parseInt(b.ano);
      if (yA !== yB) return yA - yB;
      return MESES_ORDEM.indexOf(a.mes) - MESES_ORDEM.indexOf(b.mes);
    });

    const empresas = Array.from(new Set(data.map(d => d.Empresa).filter(Boolean))).sort() as string[];
    const departamentos = Array.from(new Set(data.map(d => d.Departamento).filter(Boolean))).sort() as string[];
    const contasDre = Array.from(new Set(data.map(d => d.ContaDRE).filter(Boolean))).sort() as string[];
    const projetos = Array.from(new Set(data.map(d => d.Projeto).filter(Boolean))).sort() as string[];
    const categorias = Array.from(new Set(data.map(d => d.Categoria).filter(Boolean))).sort() as string[];
    const periodosList = periodos.map(p => `${p.mes}/${p.ano}`);

    return {
      data: data as DreRow[],
      metadata: { empresas, departamentos, contasDre, projetos, categorias, periodos: periodosList, mapaMeses }
    };
  }

  /**
   * LAYER 3: CALCULATION
   * Processa os filtros, totaliza as categorias e executa a DRE estrutural baseada no legado
   */
  static calculate(
    data: DreRow[],
    metadata: DreMetadata,
    estrutura: DreStructureItem[],
    filters: DreFilters,
    simulationParams?: DreSimulationParams,
    equipamentoCounts?: Record<string, Record<string, number>>
  ): DreCalculatedResult {
    let df = [...data];

    if (filters.empresas.length > 0) df = df.filter(row => filters.empresas.includes(row.Empresa));
    if (filters.departamentos.length > 0) df = df.filter(row => filters.departamentos.includes(row.Departamento));
    if (filters.contasDre.length > 0) df = df.filter(row => filters.contasDre.includes(row.ContaDRE));
    if (filters.projetos.length > 0) df = df.filter(row => filters.projetos.includes(row.Projeto));
    if (filters.categorias.length > 0) df = df.filter(row => filters.categorias.includes(row.Categoria));

    const sortColumns = (cols: string[]) => {
      return [...cols].sort((a, b) => {
        const partesA = a.split('/');
        const partesB = b.split('/');
        if (partesA.length !== 2 || partesB.length !== 2) return 0;
        const mesA = partesA[0].trim().charAt(0).toUpperCase() + partesA[0].trim().slice(1).toLowerCase();
        const mesB = partesB[0].trim().charAt(0).toUpperCase() + partesB[0].trim().slice(1).toLowerCase();
        const anoA = parseInt(partesA[1].trim());
        const anoB = parseInt(partesB[1].trim());
        const yA = anoA < 100 ? 2000 + anoA : anoA;
        const yB = anoB < 100 ? 2000 + anoB : anoB;
        if (yA !== yB) return yA - yB;
        return MESES_ORDEM.indexOf(mesA) - MESES_ORDEM.indexOf(mesB);
      });
    };

    const allCols = sortColumns(Object.keys(metadata.mapaMeses));
    let validColumns = allCols;

    if (filters.periodos.length > 0) {
      validColumns = allCols.filter(col => {
        const mes = metadata.mapaMeses[col];
        const ano = col.split('/')[1]?.trim();
        return filters.periodos.includes(`${mes}/${ano}`);
      });
    }

    const catTotals: Record<string, number> = {};
    const catMonthly: Record<string, Record<string, number>> = {};
    const catSourceRows: Record<string, Record<string, DreRow[]>> = {};

    const subCategoriasEspecificas = [
      'Terceirização de Mão de Obra', 'Credenciado Operacional', 'Adiantamento - Credenciado Operacional',
      'Despesas com Pessoal', 'Manutenção Preventiva', 'Preventiva - B2G', 'Manutenção Corretiva',
      'Corretiva - B2G', 'Credenciado Administrativo', 'Adiantamento - Credenciado Administrativo',
      'Credenciado TI', 'Adiantamento - Credenciado TI', 'Distribuição de Dividendos', 'Dividendos',
      'Consórcios - a contemplar', 'Ativos', 'Mútuo - Entradas', 'Mútuo - Saídas', 'Equipamentos',
      'Jurídico', 'Intermediação de Negócios'
    ];

    df.forEach(row => {
      let cat = row.ContaDRE;
      
      // Se a subcategoria da linha do CSV estiver na lista de classificações específicas da estrutura do DRE,
      // nós priorizamos a Categoria para que ela apareça na linha e no card correto do dashboard!
      if (row.Categoria && subCategoriasEspecificas.some(sub => sub.toLowerCase() === row.Categoria.toString().trim().toLowerCase())) {
        cat = subCategoriasEspecificas.find(sub => sub.toLowerCase() === row.Categoria.toString().trim().toLowerCase()) || row.Categoria;
      }

      if (!cat) return;
      if (!catTotals[cat]) {
        catTotals[cat] = 0;
        catMonthly[cat] = {};
        catSourceRows[cat] = {};
        validColumns.forEach(c => {
          catMonthly[cat][c] = 0;
          catSourceRows[cat][c] = [];
        });
      }

      let multiplier = 1;
      if (simulationParams) {
        if (['Receita Bruta de Vendas', 'Receitas Indiretas', 'Outras Receitas', 'Receitas Financeiras', 'Honorários', 'Juros e devoluções', 'Recuperação de Despesas Variáveis'].includes(cat)) {
          multiplier = simulationParams.revenueMultiplier;
        } else if (['Credenciado Operacional', 'Adiantamento - Credenciado Operacional', 'Terceirização de Mão de Obra', 'Despesas com Pessoal', 'Custo dos Serviços Prestados', 'Preventiva - B2G', 'Manutenção Preventiva', 'Corretiva - B2G', 'Manutenção Corretiva', 'Outros Custos'].includes(cat)) {
          multiplier = simulationParams.costsMultiplier;
        } else if (['Credenciado Administrativo', 'Adiantamento - Credenciado Administrativo', 'Credenciado TI', 'Adiantamento - Credenciado TI', 'Despesas Administrativas', 'Despesas de Vendas e Marketing', 'Despesas Financeiras', 'Outros Tributos', 'Jurídico', 'Despesas Variáveis', 'Intermediação de Negócios'].includes(cat)) {
          multiplier = simulationParams.expensesMultiplier;
        } else if (['Impostos', 'Provisão IRPJ e CSSL Trimestral'].includes(cat)) {
          multiplier = simulationParams.taxesMultiplier ?? 1.0;
        } else if (['Consórcios - a contemplar', 'Serviços', 'Ativos'].includes(cat)) {
          multiplier = simulationParams.investmentsMultiplier ?? 1.0;
        }
      }

      validColumns.forEach(col => {
        const val = parseFloat(row[col]?.toString().replace(',', '.') || '0');
        if (!isNaN(val)) {
          const simVal = val * multiplier;
          catTotals[cat] += simVal;
          catMonthly[cat][col] += simVal;
          if (val !== 0) catSourceRows[cat][col].push(row);
        }
      });
    });

    const getCatTotal = (targetCat: string) => {
      if (!targetCat) return 0;
      const exact = catTotals[targetCat];
      if (exact !== undefined) return exact;
      const key = Object.keys(catTotals).find(k => k.trim().toLowerCase() === targetCat.trim().toLowerCase());
      return key ? catTotals[key] : 0;
    };

    const getCatMonthly = (targetCat: string, col: string) => {
      if (!targetCat) return 0;
      const exact = catMonthly[targetCat]?.[col];
      if (exact !== undefined) return exact;
      const key = Object.keys(catMonthly).find(k => k.trim().toLowerCase() === targetCat.trim().toLowerCase());
      return key ? (catMonthly[key][col] || 0) : 0;
    };

    const valoresTotal: Record<string, number> = {};
    const valoresMensal: Record<string, Record<string, number>> = {};
    const sourceRows: Record<string, Record<string, DreRow[]>> = {};

    const servicosBaseTotal = getCatTotal('Serviços');
    const consorciosTotal = getCatTotal('Consórcios - a contemplar');

    estrutura.forEach(item => {
      const isSharedExpense = filters.excludeSharedExpenses && [
        'Credenciado Administrativo',
        'Credenciado TI',
        'Despesas Administrativas',
        'Despesas de Vendas e Marketing',
        'Despesas Financeiras',
        'Outros Tributos',
        'Despesas Eventuais',
        'Despesas Variáveis',
        'Intermediação de Negócios',
        'Total Despesas Rateadas',
        'Distribuição de Dividendos',
        'Dividendos'
      ].includes(item.titulo);

      if (item.tipo === 'linha' || item.tipo === 'hidden' || (item.tipo === 'card' && item.categorias)) {
        let total = 0;
        if (!isSharedExpense) {
          item.categorias?.forEach(cat => total += getCatTotal(cat));
        }
        valoresTotal[item.titulo] = total;

        valoresMensal[item.titulo] = {};
        sourceRows[item.titulo] = {};
        validColumns.forEach(col => {
          let mesTotal = 0;
          let rowsForMonth: DreRow[] = [];
          if (!isSharedExpense) {
            item.categorias?.forEach(cat => {
              mesTotal += getCatMonthly(cat, col);
              if (catSourceRows[cat] && catSourceRows[cat][col]) {
                rowsForMonth.push(...catSourceRows[cat][col]);
              }
            });
          }
          valoresMensal[item.titulo][col] = mesTotal;
          sourceRows[item.titulo][col] = rowsForMonth;
        });
      } else if (item.tipo === 'linha_calc' && item.formula === 'servicos_menos_consorcios') {
        let totalServicosAjustado = 0;
        if (servicosBaseTotal >= consorciosTotal) {
          totalServicosAjustado = servicosBaseTotal - consorciosTotal;
        }
        valoresTotal[item.titulo] = totalServicosAjustado;

        valoresMensal[item.titulo] = {};
        sourceRows[item.titulo] = {};
        validColumns.forEach(col => {
          const s = getCatMonthly('Serviços', col);
          const c = getCatMonthly('Consórcios - a contemplar', col);
          valoresMensal[item.titulo][col] = s >= c ? s - c : 0;

          let rowsForMonth: DreRow[] = [];
          if (s >= c) {
            if (catSourceRows['Serviços'] && catSourceRows['Serviços'][col]) rowsForMonth.push(...catSourceRows['Serviços'][col]);
            if (catSourceRows['Consórcios - a contemplar'] && catSourceRows['Consórcios - a contemplar'][col]) rowsForMonth.push(...catSourceRows['Consórcios - a contemplar'][col]);
          }
          sourceRows[item.titulo][col] = rowsForMonth;
        });
      }
    });



    const getVal = (key: string) => valoresTotal[key] || 0;

    const receitaOperacional = getVal("Receita Bruta de Vendas");
    const receitaIndireta = getVal("Receitas Indiretas");
    const totalEntradas = receitaOperacional + receitaIndireta;

    const outrasEntradas = getVal("Outras Receitas") + getVal("Receitas Financeiras") + getVal("Honorários") + getVal("Juros e Devoluções") + getVal("Recuperação de Despesas Variáveis");
    const totalImpostos = getVal("Impostos") + getVal("Provisão IRPJ e CSSL Trimestral");

    const totalCustos = getCatTotal("Credenciado Operacional") + getCatTotal("Adiantamento - Credenciado Operacional") +
      getVal("Terceirização de Mão de Obra") + getVal("CLTs") + getVal("Custo dos Serviços Prestados") +
      getVal("Preventiva - B2G") + getVal("Corretiva - B2G") + getVal("Outros Custos");

    const totalDespesas = filters.excludeSharedExpenses
      ? 0
      : (getVal("Credenciado Administrativo") + getVal("Credenciado TI") +
         getVal("Despesas Administrativas") + getVal("Despesas de Vendas e Marketing") + getVal("Despesas Financeiras") +
         getVal("Outros Tributos") + getVal("Despesas Eventuais") + getVal("Despesas Variáveis") + getVal("Intermediação de Negócios") +
         getCatTotal("Distribuição de Dividendos") + getCatTotal("Dividendos"));

    const totalInvestimentos = getCatTotal("Consórcios - a contemplar") + getVal("Serviços") + getCatTotal("Ativos");
    const totalSaidas = totalImpostos + totalCustos + totalDespesas + totalInvestimentos;

    const resultado = totalEntradas - totalImpostos - totalCustos - totalDespesas;
    const fcl = totalEntradas + outrasEntradas - totalSaidas;

    // Novo: Equipamentos
    const totalEquipamentos = getCatTotal("Equipamentos");
    valoresTotal["Equipamentos"] = totalEquipamentos;

    valoresTotal["Total Entradas Operacionais"] = totalEntradas;
    valoresTotal["Outras Entradas"] = outrasEntradas;
    valoresTotal["Total de Impostos"] = totalImpostos;
    valoresTotal["Total Custos Operacionais"] = totalCustos;
    valoresTotal["Total Despesas Rateadas"] = totalDespesas;
    valoresTotal["Total Investimentos"] = totalInvestimentos;
    valoresTotal["Total Saídas"] = totalSaidas;
    valoresTotal["Lucro antes do FCL"] = resultado;
    valoresTotal["Fluxo de Caixa Livre FCL"] = fcl;
    valoresTotal["Resultado Liquido Final"] = resultado;
    valoresTotal["Impostos Gerais"] = totalImpostos;

    const percLucro = totalEntradas !== 0 ? (resultado / totalEntradas * 100) : 0;
    const percFcl = totalEntradas !== 0 ? (fcl / totalEntradas * 100) : 0;

    valoresTotal["Lucro s/ Receita Operacional"] = percLucro;
    valoresTotal["FCL s/ Receita Operacional"] = percFcl;

    const getValMensal = (key: string, col: string) => (valoresMensal[key] && valoresMensal[key][col]) ? valoresMensal[key][col] : 0;
    const getSourceRowsMensal = (key: string, col: string) => (sourceRows[key] && sourceRows[key][col]) ? sourceRows[key][col] : [];
    const getCatSourceRowsSafe = (cat: string, col: string) => {
      const key = Object.keys(catSourceRows).find(k => k.trim().toLowerCase() === cat.trim().toLowerCase());
      return key && catSourceRows[key] && catSourceRows[key][col] ? catSourceRows[key][col] : [];
    };

    valoresMensal["Total Entradas Operacionais"] = {};
    valoresMensal["Outras Entradas"] = {};
    valoresMensal["Total de Impostos"] = {};
    valoresMensal["Total Custos Operacionais"] = {};
    valoresMensal["Total Despesas Rateadas"] = {};
    valoresMensal["Total Investimentos"] = {};
    valoresMensal["Total Saídas"] = {};
    valoresMensal["Lucro antes do FCL"] = {};
    valoresMensal["Fluxo de Caixa Livre FCL"] = {};
    valoresMensal["Lucro s/ Receita Operacional"] = {};
    valoresMensal["FCL s/ Receita Operacional"] = {};
    valoresMensal["Equipamentos"] = {};

    sourceRows["Total Entradas Operacionais"] = {};
    sourceRows["Outras Entradas"] = {};
    sourceRows["Total de Impostos"] = {};
    sourceRows["Total Custos Operacionais"] = {};
    sourceRows["Total Despesas Rateadas"] = {};
    sourceRows["Total Investimentos"] = {};
    sourceRows["Total Saídas"] = {};
    sourceRows["Lucro antes do FCL"] = {};
    sourceRows["Fluxo de Caixa Livre FCL"] = {};
    sourceRows["Equipamentos"] = {};

    validColumns.forEach(col => {
      const recOp = getValMensal("Receita Bruta de Vendas", col);
      const recInd = getValMensal("Receitas Indiretas", col);
      const totEnt = recOp + recInd;
      valoresMensal["Total Entradas Operacionais"][col] = totEnt;
      sourceRows["Total Entradas Operacionais"][col] = [...getSourceRowsMensal("Receita Bruta de Vendas", col), ...getSourceRowsMensal("Receitas Indiretas", col)];

      const outrasEnt = getValMensal("Outras Receitas", col) + getValMensal("Receitas Financeiras", col) + getValMensal("Honorários", col) + getValMensal("Juros e Devoluções", col) + getValMensal("Recuperação de Despesas Variáveis", col);
      valoresMensal["Outras Entradas"][col] = outrasEnt;
      sourceRows["Outras Entradas"][col] = [
        ...getSourceRowsMensal("Outras Receitas", col), ...getSourceRowsMensal("Receitas Financeiras", col),
        ...getSourceRowsMensal("Honorários", col), ...getSourceRowsMensal("Juros e Devoluções", col), ...getSourceRowsMensal("Recuperação de Despesas Variáveis", col)
      ];

      const totImp = getValMensal("Impostos", col) + getValMensal("Provisão IRPJ e CSSL Trimestral", col);
      valoresMensal["Total de Impostos"][col] = totImp;
      sourceRows["Total de Impostos"][col] = [...getSourceRowsMensal("Impostos", col), ...getSourceRowsMensal("Provisão IRPJ e CSSL Trimestral", col)];

      const totCust = getCatMonthly("Credenciado Operacional", col) + getCatMonthly("Adiantamento - Credenciado Operacional", col) +
        getValMensal("Terceirização de Mão de Obra", col) + getValMensal("CLTs", col) + getValMensal("Custo dos Serviços Prestados", col) +
        getValMensal("Preventiva - B2G", col) + getValMensal("Corretiva - B2G", col) + getValMensal("Outros Custos", col);
      valoresMensal["Total Custos Operacionais"][col] = totCust;
      sourceRows["Total Custos Operacionais"][col] = [
        ...getCatSourceRowsSafe("Credenciado Operacional", col), ...getCatSourceRowsSafe("Adiantamento - Credenciado Operacional", col),
        ...getSourceRowsMensal("Terceirização de Mão de Obra", col), ...getSourceRowsMensal("CLTs", col), ...getSourceRowsMensal("Custo dos Serviços Prestados", col),
        ...getSourceRowsMensal("Preventiva - B2G", col), ...getSourceRowsMensal("Corretiva - B2G", col), ...getSourceRowsMensal("Outros Custos", col)
      ];

      const totDesp = filters.excludeSharedExpenses
        ? 0
        : (getValMensal("Credenciado Administrativo", col) + getValMensal("Credenciado TI", col) +
           getValMensal("Despesas Administrativas", col) + getValMensal("Despesas de Vendas e Marketing", col) + getValMensal("Despesas Financeiras", col) +
           getValMensal("Outros Tributos", col) + getValMensal("Despesas Eventuais", col) + getValMensal("Despesas Variáveis", col) + getValMensal("Intermediação de Negócios", col) +
           getCatMonthly("Distribuição de Dividendos", col) + getCatMonthly("Dividendos", col));
      valoresMensal["Total Despesas Rateadas"][col] = totDesp;
      sourceRows["Total Despesas Rateadas"][col] = [
        ...getSourceRowsMensal("Credenciado Administrativo", col), ...getSourceRowsMensal("Credenciado TI", col),
        ...getSourceRowsMensal("Despesas Administrativas", col), ...getSourceRowsMensal("Despesas de Vendas e Marketing", col), ...getSourceRowsMensal("Despesas Financeiras", col),
        ...getSourceRowsMensal("Outros Tributos", col), ...getSourceRowsMensal("Despesas Eventuais", col), ...getSourceRowsMensal("Despesas Variáveis", col), ...getSourceRowsMensal("Intermediação de Negócios", col),
        ...getCatSourceRowsSafe("Distribuição de Dividendos", col), ...getCatSourceRowsSafe("Dividendos", col)
      ];

      const totInv = getCatMonthly("Consórcios - a contemplar", col) + getValMensal("Serviços", col) + getCatMonthly("Ativos", col);
      valoresMensal["Total Investimentos"][col] = totInv;
      sourceRows["Total Investimentos"][col] = [
        ...getCatSourceRowsSafe("Consórcios - a contemplar", col), ...getSourceRowsMensal("Serviços", col), ...getCatSourceRowsSafe("Ativos", col)
      ];

      const totSai = totImp + totCust + totDesp + totInv;
      valoresMensal["Total Saídas"][col] = totSai;
      sourceRows["Total Saídas"][col] = [
        ...sourceRows["Total de Impostos"][col],
        ...sourceRows["Total Custos Operacionais"][col],
        ...sourceRows["Total Despesas Rateadas"][col],
        ...sourceRows["Total Investimentos"][col]
      ];

      const resCol = totEnt - totImp - totCust - totDesp;
      const fclCol = totEnt + outrasEnt - totSai;

      valoresMensal["Lucro antes do FCL"][col] = resCol;
      sourceRows["Lucro antes do FCL"][col] = [
        ...sourceRows["Total Entradas Operacionais"][col],
        ...sourceRows["Outras Entradas"][col],
        ...sourceRows["Total Saídas"][col]
      ];

      valoresMensal["Fluxo de Caixa Livre FCL"][col] = fclCol;
      sourceRows["Fluxo de Caixa Livre FCL"][col] = [
        ...sourceRows["Total Entradas Operacionais"][col],
        ...sourceRows["Outras Entradas"][col],
        ...sourceRows["Total Saídas"][col]
      ];

      valoresMensal["Lucro s/ Receita Operacional"][col] = totEnt !== 0 ? (resCol / totEnt * 100) : 0;
      valoresMensal["FCL s/ Receita Operacional"][col] = totEnt !== 0 ? (fclCol / totEnt * 100) : 0;
      
      valoresMensal["Equipamentos"][col] = getCatMonthly("Equipamentos", col);
      sourceRows["Equipamentos"][col] = getCatSourceRowsSafe("Equipamentos", col);
    });

    const activeMachinesList = validColumns.map(col => {
      const monthCounts = equipamentoCounts?.[col] || {};
      const activeDepts = filters.departamentos.length > 0 
        ? filters.departamentos 
        : Object.keys(monthCounts);

      let sum = 0;
      activeDepts.forEach(dept => {
        sum += monthCounts[dept] || 0;
      });
      return sum;
    });
    const machinesSum = activeMachinesList.reduce((a, b) => a + b, 0);
    const averageMachines = validColumns.length > 0 ? (machinesSum / validColumns.length) : 0;

    return {
      totais: valoresTotal,
      mensal: valoresMensal,
      estrutura: estrutura,
      validColumns,
      sourceRows,
      kpis: {
        receitaOperacional,
        receitaIndireta,
        totalEntradas,
        outrasEntradas,
        totalImpostos,
        totalCustos,
        totalDespesas,
        totalInvestimentos,
        totalSaidas,
        resultado,
        fcl,
        percLucro,
        percFcl,
        totalEquipamentos,
        averageMachines
      }
    };
  }
}
