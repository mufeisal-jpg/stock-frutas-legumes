import React, { useEffect, useMemo, useState } from 'react'
import { readWorkbookToCatalog, type Catalog } from './importers'
import { getTodayKey } from './utils'

type QtyMap = Record<string, string> // productId -> free text (ex: "10 kg", "3 cx")

const LS_CATALOG = 'stock_catalog_v1'
const LS_STATE = 'stock_state_v1' // { dateKey, qtyByProductId }

type PersistedState = {
  dateKey: string
  qtyByProductId: QtyMap
}

const DEFAULT_CATALOG: Catalog = {
  categories: [
    { name: 'Frutas', products: [] },
    { name: 'Legumes & Veg', products: [] },
    { name: 'Plantas', products: [] },
    { name: 'Tropicais', products: [] },
    { name: '4ª Gama', products: [] },
  ],
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export default function App() {
  const todayKey = getTodayKey()

  const [catalog, setCatalog] = useState<Catalog>(() => {
    return safeParse<Catalog>(localStorage.getItem(LS_CATALOG)) ?? DEFAULT_CATALOG
  })

  const [state, setState] = useState<PersistedState>(() => {
    const existing = safeParse<PersistedState>(localStorage.getItem(LS_STATE))
    if (!existing) return { dateKey: todayKey, qtyByProductId: {} }

    // Se mudou o dia, copiamos o stock de ontem automaticamente (para saber o que tens hoje de manhã)
    if (existing.dateKey !== todayKey) {
      return { dateKey: todayKey, qtyByProductId: existing.qtyByProductId ?? {} }
    }
    return existing
  })

  const [activeCategory, setActiveCategory] = useState(() => catalog.categories[0]?.name ?? 'Frutas')
  const [query, setQuery] = useState('')

  useEffect(() => {
    localStorage.setItem(LS_CATALOG, JSON.stringify(catalog))
  }, [catalog])

  useEffect(() => {
    localStorage.setItem(LS_STATE, JSON.stringify(state))
  }, [state])

  // quando o catálogo muda, garante que a categoria ativa existe
  useEffect(() => {
    const exists = catalog.categories.some(c => c.name === activeCategory)
    if (!exists) setActiveCategory(catalog.categories[0]?.name ?? 'Frutas')
  }, [catalog, activeCategory])

  const active = useMemo(() => catalog.categories.find(c => c.name === activeCategory), [catalog, activeCategory])

  const filteredProducts = useMemo(() => {
    const products = active?.products ?? []
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(p => p.name.toLowerCase().includes(q))
  }, [active, query])

  function setQty(productId: string, value: string) {
    setState(prev => ({
      ...prev,
      qtyByProductId: { ...prev.qtyByProductId, [productId]: value }
    }))
  }

  function clearAll() {
    setState({ dateKey: todayKey, qtyByProductId: {} })
  }

  async function onImportFile(file: File) {
    const buf = await file.arrayBuffer()
    const newCatalog = readWorkbookToCatalog(buf)
    setCatalog(newCatalog)
    // mantém quantidades existentes (se o mesmo produto continuar com o mesmo id, fica igual)
  }

  const totalProducts = useMemo(() => catalog.categories.reduce((acc, c) => acc + c.products.length, 0), [catalog])

  return (
    <div className="wrap">
      <header className="topbar">
        <div>
          <div className="title">Stock — Frutas & Legumes</div>
          <div className="subtitle">Dia: <b>{todayKey}</b> • Produtos: <b>{totalProducts}</b></div>
        </div>

        <div className="actions">
          <label className="btn">
            Importar Excel/CSV
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImportFile(f)
                e.currentTarget.value = ''
              }}
              style={{ display: 'none' }}
            />
          </label>

          <button className="btn danger" onClick={clearAll}>Limpar quantidades</button>
        </div>
      </header>

      <main className="main">
        <aside className="sidebar">
          {catalog.categories.map(cat => (
            <button
              key={cat.name}
              className={cat.name === activeCategory ? 'cat active' : 'cat'}
              onClick={() => setActiveCategory(cat.name)}
            >
              <span>{cat.name}</span>
              <span className="pill">{cat.products.length}</span>
            </button>
          ))}
        </aside>

        <section className="content">
          <div className="contentTop">
            <div className="h2">{activeCategory}</div>
            <input
              className="search"
              placeholder="Procurar produto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="empty">
              <p>Não há produtos nesta categoria (ou a pesquisa não encontrou nada).</p>
              <p>Dica: usa <b>Importar Excel/CSV</b> para carregar a tua tabela.</p>
            </div>
          ) : (
            <div className="table">
              <div className="row head">
                <div>Produto</div>
                <div>Quantidade (livre)</div>
              </div>

              {filteredProducts.map(p => (
                <div className="row" key={p.id}>
                  <div className="prod">{p.name}</div>
                  <div>
                    <input
                      className="qty"
                      inputMode="text"
                      placeholder='ex: "10 kg"  |  "3 cx"  |  "12 un"'
                      value={state.qtyByProductId[p.id] ?? ''}
                      onChange={(e) => setQty(p.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <footer className="footerNote">
            <div>
              A app guarda tudo automaticamente neste telemóvel. Se mudares de telemóvel, volta a importar o Excel.
            </div>
          </footer>
        </section>
      </main>
    </div>
  )
}