import * as XLSX from 'xlsx'

export type Product = { id: string; name: string }
export type Category = { name: string; products: Product[] }
export type Catalog = { categories: Category[] }

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function makeId(categoryName: string, productName: string) {
  return `${slug(categoryName)}__${slug(productName)}`
}

function readCsvToCategory(name: string, text: string): Category {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const products = lines.map(line => {
    // aceita "produto;..." e "produto,..." e "produto\t..."
    const first = line.split(/[;\t,]/)[0]?.trim() ?? ''
    return first
  }).filter(Boolean).map(p => ({ id: makeId(name, p), name: p }))
  return { name, products }
}

export function readWorkbookToCatalog(fileArrayBuffer: ArrayBuffer): Catalog {
  const wb = XLSX.read(fileArrayBuffer, { type: 'array' })
  const categories: Category[] = []

  // Se for CSV, XLSX mete uma sheet "Sheet1"
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false }) as any[][]
    // pega na primeira coluna como nome do produto
    const products: Product[] = rows
      .map(r => (r?.[0] ?? '').toString().trim())
      .filter(v => v && v.toLowerCase() !== 'produto' && v.toLowerCase() !== 'product')
      .map(name => ({ id: makeId(sheetName, name), name }))

    // remove duplicados mantendo ordem
    const seen = new Set<string>()
    const unique = products.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)))

    categories.push({ name: sheetName, products: unique })
  }

  return { categories }
}