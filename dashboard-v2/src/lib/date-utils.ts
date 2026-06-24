const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Converte coluna do DRE (Ex: "Jan/24") para formato ISO "YYYY-MM"
 */
export function colToIso(col: string): string {
  const partes = col.split('/');
  if (partes.length !== 2) return '';
  const mesStr = partes[0].trim();
  const anoStr = partes[1].trim();
  const mesIdx = MESES_PT.findIndex(m => m.toLowerCase() === mesStr.toLowerCase());
  if (mesIdx === -1) return '';
  const ano = parseInt(anoStr) < 100 ? 2000 + parseInt(anoStr) : parseInt(anoStr);
  const mesPadded = String(mesIdx + 1).padStart(2, '0');
  return `${ano}-${mesPadded}`;
}

/**
 * Converte data ISO "YYYY-MM" para formato de coluna DRE "MMM/YY"
 */
export function isoToCol(iso: string): string {
  const partes = iso.split('-');
  if (partes.length < 2) return '';
  const ano = parseInt(partes[0]);
  const mes = parseInt(partes[1]);
  if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) return '';
  const mesStr = MESES_PT[mes - 1];
  const anoCurto = String(ano).slice(-2);
  return `${mesStr}/${anoCurto}`;
}

/**
 * Adiciona N meses a uma data ISO "YYYY-MM"
 */
export function addMonthsIso(iso: string, n: number): string {
  const partes = iso.split('-');
  if (partes.length < 2) return iso;
  let ano = parseInt(partes[0]);
  let mes = parseInt(partes[1]);
  if (isNaN(ano) || isNaN(mes)) return iso;

  // Converter para base zero, adicionar n meses e reconverter
  const totalMeses = ano * 12 + (mes - 1) + n;
  const novoAno = Math.floor(totalMeses / 12);
  const novoMes = (totalMeses % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, '0')}`;
}

/**
 * Adiciona N meses a uma coluna DRE "MMM/YY"
 */
export function addMonthsCol(col: string, n: number): string {
  const iso = colToIso(col);
  if (!iso) return col;
  const novaIso = addMonthsIso(iso, n);
  return isoToCol(novaIso);
}

/**
 * Calcula a diferença em meses entre duas datas ISO "YYYY-MM" (fim - inicio)
 */
export function diffMonthsIso(inicio: string, fim: string): number {
  const p1 = inicio.split('-');
  const p2 = fim.split('-');
  if (p1.length < 2 || p2.length < 2) return 0;
  const y1 = parseInt(p1[0]), m1 = parseInt(p1[1]);
  const y2 = parseInt(p2[0]), m2 = parseInt(p2[1]);
  return (y2 * 12 + m2) - (y1 * 12 + m1);
}

/**
 * Verifica se uma coluna do DRE (Ex: "Fev/26") está no intervalo de datas ISO (inclusive)
 */
export function isColInPeriod(col: string, startIso: string, endIso: string): boolean {
  const colIso = colToIso(col);
  if (!colIso) return false;
  return colIso >= startIso && colIso <= endIso;
}

/**
 * Retorna uma lista de strings ISO "YYYY-MM" entre duas datas ISO (inclusive)
 */
export function getIsoRange(startIso: string, endIso: string): string[] {
  const range: string[] = [];
  let curr = startIso;
  while (curr <= endIso) {
    range.push(curr);
    curr = addMonthsIso(curr, 1);
  }
  return range;
}

/**
 * Ordena colunas no formato DRE "MMM/YY" cronologicamente
 */
export function sortColList(cols: string[]): string[] {
  return [...cols].sort((a, b) => {
    const isoA = colToIso(a);
    const isoB = colToIso(b);
    return isoA.localeCompare(isoB);
  });
}
