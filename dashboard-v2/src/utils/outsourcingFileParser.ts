import * as XLSX from 'xlsx';
import { OutsourcingRow, EmployeeType } from '@/components/people/OutsourcingCockpitModal';

export interface OutsourcingParseResult {
  rows: OutsourcingRow[];
  detectedTaxRate?: number;
  detectedAdminFeeRate?: number;
  competencia?: string;
  totalParsed: number;
  warnings: string[];
}

/**
 * Converte qualquer valor em número (limpa 'R$', espaços, formatações brasileiras e nulos)
 */
export function cleanNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let s = String(val).trim();
  if (s === '' || s === '-' || s === 'R$ -' || s.includes('R$ -')) return 0;

  // Remover R$, espaços
  s = s.replace(/R\$\s*/gi, '').replace(/\s+/g, '');

  // Tratar formato brasileiro: 1.234,56 -> 1234.56
  if (s.includes(',') && s.includes('.')) {
    if (s.indexOf('.') < s.indexOf(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Normaliza o tipo de vínculo (CLT, PJ, Estágio, Outro)
 */
export function parseEmployeeType(val: any): EmployeeType {
  if (!val) return 'CLT';
  const s = String(val).trim().toLowerCase();
  if (s.includes('pj') || s.includes('mei') || s.includes('prestador') || s.includes('serviço') || s.includes('servico')) {
    return 'PJ';
  }
  if (s.includes('estag') || s.includes('estág')) {
    return 'Estagio';
  }
  if (s.includes('clt') || s.includes('celetista')) {
    return 'CLT';
  }
  return 'CLT';
}

/**
 * Parser inteligente de arquivos Excel (.xlsx / .xls) ou CSV para o Cockpit de Terceirização
 */
export function parseOutsourcingFile(fileData: ArrayBuffer | Uint8Array | string): OutsourcingParseResult {
  const workbook = typeof fileData === 'string'
    ? XLSX.read(fileData, { type: 'string' })
    : XLSX.read(fileData, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Nenhuma planilha encontrada no arquivo.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  let headerRowIndex = -1;
  let detectedTaxRate: number | undefined = undefined;
  const warnings: string[] = [];

  // 1. Varrer as primeiras 15 linhas procurando o cabeçalho e eventuais taxas
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row)) continue;

    // Procurar taxa de ISS antes da tabela (ex: 'ISS:', 0.1348 -> 13.48%)
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim().toLowerCase();
      if (cell === 'iss:' || cell === 'iss' || cell.includes('iss %') || cell.includes('alíquota iss')) {
        const nextVal = row[j + 1];
        const num = cleanNumeric(nextVal);
        if (num > 0) {
          detectedTaxRate = num < 1 ? parseFloat((num * 100).toFixed(4)) : num;
        }
      }
    }

    // Identificar a linha de cabeçalho da tabela
    const rowStr = row.map(c => String(c || '').toLowerCase()).join(' | ');
    if (
      (rowStr.includes('colaborador') || rowStr.includes('nome') || rowStr.includes('prestador')) &&
      (rowStr.includes('centro de custo') || rowStr.includes('local') || rowStr.includes('bruto') || rowStr.includes('fixo') || rowStr.includes('líquido') || rowStr.includes('fgts'))
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  const headers = (rawRows[headerRowIndex] || []).map(h => String(h || '').trim().toLowerCase());

  // Mapear índices das colunas
  const findColIndex = (...keywords: string[]) => {
    return headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));
  };

  const colIdxTipo = findColIndex('item', 'tipo', 'regime', 'vínculo', 'vinculo');
  const colIdxNome = findColIndex('colaborador', 'nome', 'prestador', 'funcionário', 'funcionario');
  const colIdxLocal = findColIndex('centro de custo', 'localidade', 'filial', 'local', 'setor', 'departamento');
  
  // Colunas de Valores Bruto, Desconto e Líquido
  const colIdxBruto = findColIndex('valor bruto', 'salário bruto', 'salario bruto', 'salário base', 'salario base', 'fixo', 'holerite', 'remuneração', 'nf');
  const colIdxDesconto = findColIndex('desconto', 'descontos', 'desc');
  const colIdxLiquido = findColIndex('valor líquido', 'valor liquido', 'líquido', 'liquido');

  // Demais verbas
  const colIdxBonus = findColIndex('bonificação', 'bonificao', 'bonificacao', 'bônus', 'bonus', 'comissão', 'comissao');
  const colIdxAdiantamento = findColIndex('adiantamento', 'ajuda custo', 'adit');
  const colIdxEmprestimo = findColIndex('empréstimo', 'emprestimo', 'empréstimos', 'emprestimos');
  const colIdxVR = findColIndex('vr', 'vale refeição', 'vale refeicao', 'refeição', 'refeicao');
  const colIdxVT = findColIndex('vt', 'vale transporte', 'transporte');
  const colIdxSeguro = findColIndex('seguro', 'seguro vida');
  const colIdxFGTS = findColIndex('fgts');
  const colIdxGPS = findColIndex('gps', 'inss', 'previdência', 'previdencia');
  const colIdxPerfil = findColIndex('perfil');
  const colIdx13 = findColIndex('13º', '13o', '13', 'décimo terceiro', 'decimo terceiro');
  const colIdxFerias = findColIndex('férias', 'ferias');
  const colIdxOutros = findColIndex('outros', 'incentivos');

  const parsedRows: OutsourcingRow[] = [];

  // 2. Processar as linhas de dados (após o cabeçalho)
  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row)) continue;

    const rawNome = colIdxNome !== -1 ? row[colIdxNome] : row[1];
    if (!rawNome) continue;

    const nomeStr = String(rawNome).trim();
    if (!nomeStr) continue;

    // Ignorar linhas de total, notas ou relatórios
    const lowerNome = nomeStr.toLowerCase();
    if (
      lowerNome === 'total' ||
      lowerNome.startsWith('total') ||
      lowerNome.includes('relatório') ||
      lowerNome.includes('relatorio') ||
      lowerNome.includes('lançamento') ||
      lowerNome.includes('lancamento') ||
      lowerNome.includes('créditos') ||
      lowerNome.includes('saldo') ||
      lowerNome.includes('a cobrir') ||
      lowerNome.includes('a compensar') ||
      lowerNome.includes('a descontar')
    ) {
      continue;
    }

    const rawTipo = colIdxTipo !== -1 ? row[colIdxTipo] : (typeof row[0] === 'string' ? row[0] : null);
    const rawLocal = colIdxLocal !== -1 ? row[colIdxLocal] : (typeof row[2] === 'string' ? row[2] : 'Matriz');

    const empType = parseEmployeeType(rawTipo);
    const location = String(rawLocal || 'Matriz').trim();

    let valorBruto = colIdxBruto !== -1 ? cleanNumeric(row[colIdxBruto]) : 0;
    let valorDesconto = colIdxDesconto !== -1 ? cleanNumeric(row[colIdxDesconto]) : 0;
    let valorLiquido = colIdxLiquido !== -1 ? cleanNumeric(row[colIdxLiquido]) : 0;

    // Se o valor bruto ou líquido vieram na planilha mas o desconto não foi informado
    if (valorBruto > 0 && valorLiquido > 0 && valorDesconto === 0 && valorBruto > valorLiquido) {
      valorDesconto = valorBruto - valorLiquido;
    } else if (valorBruto > 0 && valorLiquido === 0) {
      valorLiquido = valorBruto - valorDesconto;
    } else if (valorBruto === 0 && valorLiquido > 0) {
      valorBruto = valorLiquido + valorDesconto;
    }

    const valorBonus = colIdxBonus !== -1 ? cleanNumeric(row[colIdxBonus]) : 0;
    const valorAjudaCusto = colIdxAdiantamento !== -1 ? cleanNumeric(row[colIdxAdiantamento]) : 0;
    const valorEmprestimo = colIdxEmprestimo !== -1 ? cleanNumeric(row[colIdxEmprestimo]) : 0;
    const valorVR = colIdxVR !== -1 ? cleanNumeric(row[colIdxVR]) : 0;
    const valorVT = colIdxVT !== -1 ? cleanNumeric(row[colIdxVT]) : 0;
    const valorSeguro = colIdxSeguro !== -1 ? cleanNumeric(row[colIdxSeguro]) : 0;
    const valorFGTS = colIdxFGTS !== -1 ? cleanNumeric(row[colIdxFGTS]) : 0;
    const valorGPS = colIdxGPS !== -1 ? cleanNumeric(row[colIdxGPS]) : 0;
    const valorPerfil = colIdxPerfil !== -1 ? cleanNumeric(row[colIdxPerfil]) : 0;
    const valorDecTerceiro = colIdx13 !== -1 ? cleanNumeric(row[colIdx13]) : 0;
    const valorFerias = colIdxFerias !== -1 ? cleanNumeric(row[colIdxFerias]) : 0;
    const valorOutros = colIdxOutros !== -1 ? cleanNumeric(row[colIdxOutros]) : 0;

    const gpsFinal = valorGPS > 0 ? valorGPS : valorPerfil;
    const outrosFinal = valorGPS > 0 && valorPerfil > 0 ? valorOutros + valorPerfil : valorOutros;

    parsedRows.push({
      id: `imported-${Date.now()}-${i}`,
      name: nomeStr,
      location: location || 'Matriz',
      employeeType: empType,
      isManual: true,
      valorBruto,
      valorDesconto,
      valorLiquido,
      valorBonus,
      valorComissao: 0,
      valorAjudaCusto,
      valorVR,
      valorVT,
      valorSeguro,
      valorFGTS,
      valorGPS: gpsFinal,
      valorDecTerceiro,
      valorFerias,
      valorOutros: outrosFinal,
      valorEmprestimo,
      customValues: {}
    });
  }

  return {
    rows: parsedRows,
    detectedTaxRate,
    totalParsed: parsedRows.length,
    warnings
  };
}

/**
 * Gera e faz o download de uma planilha modelo (.xlsx) para preenchimento de terceirização
 */
export function exportOutsourcingTemplate() {
  const headers = [
    'Tipo (CLT/PJ/Estágio)',
    'Colaborador',
    'Localidade / Centro de Custo',
    'Valor Bruto (R$)',
    'Desconto (R$)',
    'Valor Líquido (R$)',
    'Adiantamento (R$)',
    'Bônus (R$)',
    'VR (R$)',
    'VT (R$)',
    'Seguro (R$)',
    'FGTS (R$)',
    'GPS / INSS (R$)',
    '13º Salário (R$)',
    'Férias (R$)',
    'Outros (R$)',
    'Empréstimos (R$)'
  ];

  const sampleRows = [
    [
      'CLT',
      'Exemplo Colaborador Celetista',
      'Santos',
      3037.67,
      1104.01,
      1933.66,
      739.92,
      0,
      0,
      273.00,
      14.96,
      243.01,
      253.10,
      0,
      0,
      45.60,
      0
    ],
    [
      'PJ',
      'Exemplo Prestador PJ',
      'Mar Brasil',
      5000.00,
      0,
      5000.00,
      0,
      500.00,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    [
      'Estágio',
      'Exemplo Estagiário',
      'Bertioga',
      1500.00,
      0,
      1500.00,
      0,
      0,
      0,
      250.00,
      14.96,
      0,
      0,
      0,
      0,
      0,
      0
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  ws['!cols'] = [
    { wch: 22 },
    { wch: 30 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 16 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Terceirizacao');

  XLSX.writeFile(wb, 'Modelo_Importacao_Terceirizacao.xlsx');
}
