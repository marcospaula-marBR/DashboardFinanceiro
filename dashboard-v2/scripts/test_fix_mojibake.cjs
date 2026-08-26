function fixMojibake(str) {
  if (!str) return '';
  let result = str;
  try {
    if (/[\u00C2\u00C3]/.test(result)) {
      const decoded = decodeURIComponent(escape(result));
      if (decoded && !/[\u00C2\u00C3]/.test(decoded)) {
        return decoded;
      }
    }
  } catch (e) {}

  const replacements = {
    'Ã£': 'ã', 'Ã¡': 'á', 'Ã ': 'à', 'Ã¢': 'â', 'Ã¤': 'ä',
    'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê', 'Ã«': 'ë',
    'Ã­': 'í', 'Ã¬': 'ì', 'Ã®': 'î', 'Ã¯': 'ï',
    'Ã³': 'ó', 'Ã²': 'ò', 'Ã´': 'ô', 'Ãµ': 'õ', 'Ã¶': 'ö',
    'Ãº': 'ú', 'Ã¹': 'ù', 'Ã»': 'û', 'Ã¼': 'ü',
    'Ã§': 'ç', 'Ã±': 'ñ',
    'Ãƒ': 'Ã', 'Ã': 'Á', 'Ã€': 'À', 'Ã‚': 'Â',
    'Ã‰': 'É', 'Ãˆ': 'È', 'ÃŠ': 'Ê',
    'Ã': 'Í', 'ÃŒ': 'Ì', 'ÃŽ': 'Î',
    'Ã“': 'Ó', 'Ã’': 'Ò', 'Ã”': 'Ô', 'Ã•': 'Õ',
    'Ãš': 'Ú', 'Ã™': 'Ù', 'Ã›': 'Û',
    'Ã‡': 'Ç',
    'Âº': 'º', 'Âª': 'ª', 'Â§': '§', 'Â°': '°'
  };

  for (const [bad, good] of Object.entries(replacements)) {
    result = result.split(bad).join(good);
  }
  return result;
}

console.log('Teste 1:', fixMojibake('Bradesco - cartÃ£o 2192'));
console.log('Teste 2:', fixMojibake('CartÃ£o - Sicredi 0129'));
console.log('Teste 3:', fixMojibake('CrÃ©ditos - DZM'));
console.log('Teste 4:', fixMojibake('São Paulo CMSP CSP 274/2024'));
console.log('Teste 5:', fixMojibake('SÃ£o Paulo CMSP CSP 274/2024'));
