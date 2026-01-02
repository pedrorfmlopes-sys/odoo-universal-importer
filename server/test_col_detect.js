
const keys = ['PrintConfigCode', 'PriceListID', 'FamilyName', 'nome_ITA', 'nome_ENG', 'nome_SPA', 'FeatureCode1', 'UnitPrice', 'BARCODE'];
const nameKeywords = ['name', 'nome', 'description', 'descrição', 'descrizione', 'family', 'familia', 'famille', 'serie', 'coleção', 'colección', 'collection', 'nome_ita', 'nome_spa', 'nome_eng'];

const actualNameCol = keys.find(k => nameKeywords.some(kw => k.trim().toLowerCase().includes(kw)));
console.log('Detected Name Column:', actualNameCol);
