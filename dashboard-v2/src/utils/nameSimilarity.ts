/**
 * Algoritmo de Similaridade de Nomes (Fuzzy / Levenshtein + Token Jaccard + Boundary Matching)
 * Retorna uma pontuação entre 0.0 (semelhante a nada) e 1.0 (correspondência exata).
 */
export function calculateNameSimilarity(nameA: string, nameB: string): number {
  if (!nameA || !nameB) return 0;
  
  const normalize = (str: string) => {
    let s = str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ");
    
    // Normalizações fonéticas e variações frequentes em português
    s = s
      .replace(/\bsouza\b/g, "sousa")
      .replace(/\bluiz\b/g, "luis")
      .replace(/\bmontte\b/g, "monte")
      .replace(/\bnetto\b/g, "neto")
      .replace(/\bterceirizad[oa]\b/g, "")
      .replace(/\b(de|da|do|dos|das|e)\b/g, " ");
    
    return s.split(/\s+/).filter(w => w.length > 0);
  };

  const wordsA = normalize(nameA);
  const wordsB = normalize(nameB);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const strA = wordsA.join(' ');
  const strB = wordsB.join(' ');

  if (strA === strB) return 1.0;

  // Jaccard similarity on tokens
  const setB = new Set(wordsB);
  const intersection = wordsA.filter(w => setB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  const tokenScore = intersection.length / union.size;

  // First & Last Name Match (com suporte a prefixos truncados como Ferreir vs Ferreira, Carl vs Carlos)
  const firstNameA = wordsA[0];
  const firstNameB = wordsB[0];
  const lastNameA = wordsA[wordsA.length - 1];
  const lastNameB = wordsB[wordsB.length - 1];

  const firstMatches = firstNameA === firstNameB;
  const lastMatches = lastNameA === lastNameB || 
    (lastNameA.length >= 4 && lastNameB.length >= 4 && (lastNameA.startsWith(lastNameB) || lastNameB.startsWith(lastNameA)));

  let boundaryBonus = 0;
  if (firstMatches && wordsA.length > 1 && wordsB.length > 1) {
    if (lastMatches) {
      boundaryBonus = 0.5;
    } else {
      boundaryBonus = 0.25;
    }
  }

  // Levenshtein distance
  const levDistance = (a: string, b: string) => {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  };

  const maxLen = Math.max(strA.length, strB.length);
  const levScore = maxLen > 0 ? (1 - levDistance(strA, strB) / maxLen) : 0;

  let finalScore = (tokenScore * 0.45) + (levScore * 0.25) + (boundaryBonus * 0.3);

  // Se o primeiro e o último nome combinam e há interseção de palavras relevante, garante similaridade alta
  if (firstMatches && lastMatches && intersection.length >= 2) {
    finalScore = Math.max(0.88, finalScore);
  }

  return Math.min(1.0, Math.max(0, finalScore));
}

export interface NameMatchResult {
  status: 'EXACT' | 'SIMILAR' | 'NEW';
  similarity: number;
  matchedEmployeeId?: string;
  matchedEmployeeName?: string;
}

export function findBestNameMatch(
  targetName: string,
  existingEmployees: { id: string; name: string }[]
): NameMatchResult {
  if (!targetName || existingEmployees.length === 0) {
    return { status: 'NEW', similarity: 0 };
  }

  let bestScore = 0;
  let bestMatch: { id: string; name: string } | null = null;

  for (const emp of existingEmployees) {
    const score = calculateNameSimilarity(targetName, emp.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = emp;
    }
  }

  if (bestScore >= 0.95) {
    return {
      status: 'EXACT',
      similarity: bestScore,
      matchedEmployeeId: bestMatch?.id,
      matchedEmployeeName: bestMatch?.name,
    };
  }

  if (bestScore >= 0.55 && bestMatch) {
    return {
      status: 'SIMILAR',
      similarity: bestScore,
      matchedEmployeeId: bestMatch.id,
      matchedEmployeeName: bestMatch.name,
    };
  }

  return { status: 'NEW', similarity: bestScore };
}
