import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ShoppingBag, X, Calculator, Loader2, Upload, Search } from 'lucide-react'
import { adminRetailProductApi, productApi, uploadApi } from '@/services/api'
import { compressImage } from '@/utils/imageUtils'
import ImageCropperModal from '@/components/ImageCropperModal'
import type { RetailProduct, Product } from '@/types'

type SellMode = 'as_is' | 'bundle' | 'split'

const initialForm = {
  source_product_id: '',
  name: '',
  description: '',
  retail_price: '',
  tax_rate: '8',
  retail_unit: '',
  retail_quantity_label: '',
  conversion_factor: '1',
  set_quantity: '1',
  sell_mode: 'as_is' as SellMode,
  image_url: '',
  image_urls: [] as string[],
  category: '',
  is_active: true,
  is_featured: false,
  is_wakeari: false,
}

export default function RetailProductManagement() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(initialForm)
  const [filterText, setFilterText] = useState('')
  const [sourceSearchText, setSourceSearchText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch retail products
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'retail-products'],
    queryFn: async () => {
      const res = await adminRetailProductApi.list({ limit: 500 })
      return res.data
    },
    refetchOnMount: 'always',
    staleTime: 0,
  })

  // Fetch source (farmer) products for dropdown
  const { data: sourceProductsData } = useQuery({
    queryKey: ['admin', 'source-products'],
    queryFn: async () => {
      const res = await productApi.list({ is_active: 1, limit: 1000 })
      return res.data
    },
  })

  const sourceProducts: Product[] = sourceProductsData?.items || []
  const retailProducts: RetailProduct[] = data?.items || []

  const filteredSourceProducts = useMemo(() => {
    if (!sourceSearchText) return sourceProducts
    const q = sourceSearchText.toLowerCase()
    return sourceProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.farmer?.name || '').toLowerCase().includes(q)
    )
  }, [sourceProducts, sourceSearchText])

  const filteredProducts = useMemo(() => {
    if (!filterText) return retailProducts
    return retailProducts.filter(p =>
      p.name.includes(filterText) ||
      p.source_product?.name?.includes(filterText) ||
      p.source_product?.farmer_name?.includes(filterText)
    )
  }, [retailProducts, filterText])

  const createMutation = useMutation({
    mutationFn: (payload: any) => adminRetailProductApi.create(payload),
    onSuccess: () => {
      toast.success('小売商品を作成しました')
      queryClient.invalidateQueries({ queryKey: ['admin', 'retail-products'] })
      resetForm()
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : '作成に失敗しました')
      console.error('Create error:', e?.response?.data || e)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => adminRetailProductApi.update(id, data),
    onSuccess: () => {
      toast.success('小売商品を更新しました')
      queryClient.invalidateQueries({ queryKey: ['admin', 'retail-products'] })
      resetForm()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '更新に失敗しました'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminRetailProductApi.delete(id),
    onSuccess: () => {
      toast.success('小売商品を削除しました')
      queryClient.invalidateQueries({ queryKey: ['admin', 'retail-products'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '削除に失敗しました'),
  })

  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false)
  const handleSuggestPrice = async () => {
    const sp = sourceProducts.find(p => p.id === Number(form.source_product_id))
    if (!sp?.cost_price) { toast.error('元商品の仕入れ値が設定されていません'); return }
    setIsSuggestingPrice(true)
    try {
      const res = await adminRetailProductApi.suggestPrice({
        cost_price: sp.cost_price,
        conversion_factor: parseFloat(form.conversion_factor) || 1,
      })
      setForm(prev => ({ ...prev, retail_price: res.data.suggested_price }))
      toast.success(`推奨価格: ${res.data.suggested_price}円`)
    } catch { toast.error('価格計算に失敗しました') }
    finally { setIsSuggestingPrice(false) }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropImageSrc(reader.result as string)
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropImageSrc(null)
    setIsUploading(true)
    try {
      const file = new File([croppedBlob], 'cropped.jpg', { type: 'image/jpeg' })
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
      const res = await uploadApi.uploadImage(compressed)
      const url = res.data.url
      setForm(prev => ({
        ...prev,
        image_url: prev.image_urls.length === 0 ? url : prev.image_url,
        image_urls: [...prev.image_urls, url],
      }))
      toast.success('画像をアップロードしました')
    } catch { toast.error('画像のアップロードに失敗しました') }
    finally { setIsUploading(false) }
  }

  const handleRemoveImage = (index: number) => {
    setForm(prev => {
      const newUrls = prev.image_urls.filter((_, i) => i !== index)
      return { ...prev, image_urls: newUrls, image_url: newUrls[0] || '' }
    })
  }

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    setForm(prev => {
      const newUrls = [...prev.image_urls]
      const swapIdx = direction === 'up' ? index - 1 : index + 1
      if (swapIdx < 0 || swapIdx >= newUrls.length) return prev
      ;[newUrls[index], newUrls[swapIdx]] = [newUrls[swapIdx], newUrls[index]]
      return { ...prev, image_urls: newUrls, image_url: newUrls[0] || '' }
    })
  }

  const resetForm = () => { setForm(initialForm); setEditingId(null); setShowForm(false); setSourceSearchText(''); setCropImageSrc(null) }

  const startEdit = (product: RetailProduct) => {
    setForm({
      source_product_id: String(product.source_product_id),
      name: product.name, description: product.description || '',
      retail_price: product.retail_price, tax_rate: String(product.tax_rate),
      retail_unit: product.retail_unit, retail_quantity_label: product.retail_quantity_label || '',
      conversion_factor: product.conversion_factor,
      set_quantity: String(product.set_quantity || 1),
      sell_mode: ((product.set_quantity || 1) > 1 ? 'bundle' : parseFloat(product.conversion_factor) > 1 ? 'split' : 'as_is') as SellMode,
      image_url: product.image_url || '',
      image_urls: product.image_urls || (product.image_url ? [product.image_url] : []),
      category: product.category || '',
      is_active: product.is_active === 1, is_featured: product.is_featured === 1, is_wakeari: product.is_wakeari === 1,
    })
    setEditingId(product.id); setShowForm(true); setSourceSearchText('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.source_product_id || !form.name || !form.retail_price || !form.retail_unit) {
      toast.error('元商品、商品名、小売価格、単位は必須です'); return
    }
    const payload: any = {
      source_product_id: parseInt(form.source_product_id),
      name: form.name, description: form.description || null,
      retail_price: parseFloat(form.retail_price), tax_rate: parseInt(form.tax_rate),
      retail_unit: form.retail_unit, retail_quantity_label: form.retail_quantity_label || null,
      conversion_factor: parseFloat(form.conversion_factor) || 1,
      set_quantity: parseInt(form.set_quantity) || 1,
      waste_margin_pct: 0,
      image_url: form.image_urls[0] || form.image_url || null,
      image_urls: form.image_urls.length > 0 ? form.image_urls : (form.image_url ? [form.image_url] : []),
      category: form.category || null,
      is_active: form.is_active ? 1 : 0, is_featured: form.is_featured ? 1 : 0,
      is_wakeari: form.is_wakeari ? 1 : 0, display_order: form.is_featured ? 0 : 99,
    }
    if (editingId) { updateMutation.mutate({ id: editingId, data: payload }) }
    else { createMutation.mutate(payload) }
  }

  const selectedSourceProduct = sourceProducts.find(p => p.id === Number(form.source_product_id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" />小売商品管理
        </h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
          <Plus className="w-4 h-4" />新規作成
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold">{editingId ? '小売商品 編集' : '小売商品 新規作成'}</h3>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Source Product Search */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">元商品（農家商品） *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="text" value={sourceSearchText} onChange={e => setSourceSearchText(e.target.value)}
                    placeholder="野菜名・農家名で検索..." className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm mb-1" />
                </div>
                {selectedSourceProduct && !sourceSearchText && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <span className="font-medium text-green-800">
                      {selectedSourceProduct.name} ({selectedSourceProduct.unit}) - {selectedSourceProduct.farmer?.name || `農家ID:${selectedSourceProduct.farmer_id}`}
                    </span>
                    <button type="button" onClick={() => setForm(prev => ({ ...prev, source_product_id: '' }))} className="ml-auto text-green-600 hover:text-green-800"><X size={16} /></button>
                  </div>
                )}
                {(sourceSearchText || !form.source_product_id) && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto">
                    {filteredSourceProducts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">該当する商品がありません</div>
                    ) : filteredSourceProducts.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setForm(prev => ({ ...prev, source_product_id: String(p.id), name: prev.name || p.name, image_url: prev.image_url || p.image_url || '' })); setSourceSearchText('') }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0 ${Number(form.source_product_id) === p.id ? 'bg-green-50 font-medium' : ''}`}>
                        {p.name} ({p.unit}) - {p.farmer?.name || `農家ID:${p.farmer_id}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">商品名 *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="例: 小松菜 1袋" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">カテゴリ</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">未設定</option><option value="leafy">葉物</option><option value="root">根菜</option>
                    <option value="fruit_veg">果菜</option><option value="mushroom">きのこ</option><option value="herb">ハーブ</option><option value="other">その他</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">説明</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="商品の説明文" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              {/* 小売単位・価格・税率（常に表示） */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">小売単位 *</label>
                  <input type="text" value={form.retail_unit} onChange={e => setForm({ ...form, retail_unit: e.target.value })} placeholder="例: 袋, パック, セット" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">小売価格 (税抜) *</label>
                  <div className="flex gap-2">
                    <input type="text" value={form.retail_price} onChange={e => setForm({ ...form, retail_price: e.target.value })} placeholder="300" className="flex-1 border rounded-lg px-3 py-2 text-sm font-bold" />
                    <button type="button" onClick={handleSuggestPrice} disabled={isSuggestingPrice || !form.source_product_id}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium disabled:opacity-50 whitespace-nowrap">
                      {isSuggestingPrice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calculator className="w-3 h-3" />}価格計算
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">税率</label>
                  <select value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="8">8% (軽減税率)</option><option value="10">10% (標準税率)</option>
                  </select>
                </div>
              </div>

              {/* 販売方式（セット or 小分けのときだけ設定） */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">販売方式（該当する場合のみ選択）</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'bundle' as SellMode, label: 'セットにして販売', desc: 'バラ品を束ねる' },
                    { id: 'split' as SellMode, label: '小分けにして販売', desc: '大きい単位を分割' },
                  ]).map(mode => (
                    <button key={mode.id} type="button"
                      onClick={() => {
                        if (form.sell_mode === mode.id) {
                          setForm(prev => ({ ...prev, sell_mode: 'as_is', set_quantity: '1', conversion_factor: '1' }))
                        } else {
                          const updates: any = { sell_mode: mode.id }
                          if (mode.id === 'bundle') { updates.conversion_factor = '1' }
                          if (mode.id === 'split') { updates.set_quantity = '1' }
                          setForm(prev => ({ ...prev, ...updates }))
                        }
                      }}
                      className={`p-2 rounded-lg border-2 text-left transition-all ${form.sell_mode === mode.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="text-sm font-bold">{mode.label}</div>
                      <div className="text-[10px] text-gray-500">{mode.desc}</div>
                    </button>
                  ))}
                </div>

                {form.sell_mode === 'bundle' && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <label className="text-sm font-medium text-gray-700">何個で1セット？</label>
                    <input type="number" min="2" value={form.set_quantity} onChange={e => setForm({ ...form, set_quantity: e.target.value })}
                      placeholder="例: 4" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                )}

                {form.sell_mode === 'split' && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <label className="text-sm font-medium text-gray-700">農家1単位から何パック作れる？</label>
                    <input type="number" step="0.01" min="1" value={form.conversion_factor} onChange={e => setForm({ ...form, conversion_factor: e.target.value })}
                      placeholder="例: 2" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                )}
              </div>

              {/* Image Upload (複数画像対応) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">商品画像（複数可）</label>
                {form.image_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.image_urls.map((url, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border bg-gray-50 group">
                        <img src={url} alt={`画像${idx + 1}`} className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-white text-[9px] text-center py-0.5">メイン</span>
                        )}
                        <div className="absolute top-0 right-0 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => handleRemoveImage(idx)} className="bg-black/60 text-white p-0.5 hover:bg-red-600"><X size={12} /></button>
                          {idx > 0 && (
                            <button type="button" onClick={() => handleMoveImage(idx, 'up')} className="bg-black/60 text-white text-[10px] px-1 hover:bg-blue-600">&#9650;</button>
                          )}
                          {idx < form.image_urls.length - 1 && (
                            <button type="button" onClick={() => handleMoveImage(idx, 'down')} className="bg-black/60 text-white text-[10px] px-1 hover:bg-blue-600">&#9660;</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
                    {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" />アップロード中...</> : <><Upload className="w-4 h-4" />画像を追加</>}
                  </button>
                  <p className="text-xs text-gray-400">JPG, PNG 推奨。1枚目がメイン画像になります。</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">販売中</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">おすすめに表示</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_wakeari} onChange={e => setForm({ ...form, is_wakeari: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">目玉商品</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={resetForm} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">キャンセル</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-60 flex items-center gap-2">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cropImageSrc && (
        <ImageCropperModal imageSrc={cropImageSrc} aspectRatio={1} onCancel={() => setCropImageSrc(null)} onCropComplete={handleCropComplete} title="商品画像をトリミング" />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input type="text" placeholder="商品名・農家名で検索..." className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm"
          value={filterText} onChange={(e) => setFilterText(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">小売商品がありません。「新規作成」で追加してください。</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">商品名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">価格</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">単位</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">元商品 (農家)</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">状態</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">おすすめ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {product.image_url && <img src={product.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{Number(product.retail_price).toLocaleString()}円</td>
                    <td className="px-4 py-3 text-gray-600">{product.retail_unit}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {product.source_product ? <><span>{product.source_product.name}</span>{product.source_product.farmer_name && <span className="text-xs text-gray-400 ml-1">({product.source_product.farmer_name})</span>}</> : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${product.is_active === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {product.is_active === 1 ? '販売中' : '停止'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.is_featured === 1 ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">おすすめ</span> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(product)} className="p-1.5 rounded hover:bg-gray-100" title="編集"><Pencil className="w-4 h-4 text-gray-500" /></button>
                        <button onClick={() => { if (confirm(`「${product.name}」を削除しますか？`)) deleteMutation.mutate(product.id) }} className="p-1.5 rounded hover:bg-red-50" title="削除"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
