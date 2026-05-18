import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import type { RetailProduct } from '@/types'

/** 価格有効期限を計算（info_confirmed_at から1週間刻みでローリング） */
const calcPriceValidUntil = (infoConfirmedAt: string | null | undefined): string | null => {
    if (!infoConfirmedAt) return null
    const confirmed = new Date(infoConfirmedAt)
    const now = new Date()
    const diffMs = now.getTime() - confirmed.getTime()
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    const weeksPassed = Math.floor(diffDays / 7)
    const validUntil = new Date(confirmed.getTime() + (weeksPassed + 1) * 7 * 24 * 60 * 60 * 1000)
    return `${validUntil.getMonth() + 1}/${validUntil.getDate()}`
}

/** 2週間以上未更新か判定 */
const isStale = (infoConfirmedAt: string | null | undefined): boolean => {
    if (!infoConfirmedAt) return true
    const confirmed = new Date(infoConfirmedAt)
    const now = new Date()
    return (now.getTime() - confirmed.getTime()) / (1000 * 60 * 60 * 24) >= 14
}

/** 小売単位に換算した重量を取得（セット売りの場合はセット全体の重量） */
const getRetailWeight = (product: RetailProduct): number | null => {
    if (product.weight == null || product.weight <= 0) return null
    const factor = parseFloat(product.conversion_factor) || 1
    const setQty = product.set_quantity || 1
    if (factor <= 0) return product.weight
    // 1個あたりの重量 × セット数量
    return Math.round((product.weight / factor) * setQty)
}

/** 小売単位に換算した在庫数を取得（セット売りの場合は作れるセット数） */
const getRetailStock = (product: RetailProduct): number | null => {
    if (product.stock_quantity == null) return null
    const factor = parseFloat(product.conversion_factor) || 1
    const setQty = product.set_quantity || 1
    // 農家在庫 × 換算係数 ÷ セット数量 = 作れるセット数
    return Math.floor((product.stock_quantity * factor) / setQty)
}

interface LocalProductCardProps {
    product: RetailProduct
    onAddToCart: (product: RetailProduct, quantity: number) => void
    compact?: boolean
}

/** 有機野菜バッジ */
const OrganicBadge = ({ size = 'normal' }: { size?: 'small' | 'normal' }) => {
    if (size === 'small') {
        return (
            <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-green-600 to-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow z-10">
                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-current"><path d="M6 1C3.5 1 2 3.5 2 6c0 1 .3 1.8.8 2.5C3.5 7 4.5 6 6 6s2.5 1 3.2 2.5C9.7 7.8 10 7 10 6c0-2.5-1.5-5-4-5z"/><path d="M6 7c-1 0-2 .8-2.5 2 .7.6 1.5 1 2.5 1s1.8-.4 2.5-1C8 7.8 7 7 6 7z" opacity=".7"/></svg>
                有機
            </span>
        )
    }
    return (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-gradient-to-r from-green-600 to-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md z-10 ring-1 ring-white/30">
            <svg viewBox="0 0 12 12" className="w-3 h-3 fill-current"><path d="M6 1C3.5 1 2 3.5 2 6c0 1 .3 1.8.8 2.5C3.5 7 4.5 6 6 6s2.5 1 3.2 2.5C9.7 7.8 10 7 10 6c0-2.5-1.5-5-4-5z"/><path d="M6 7c-1 0-2 .8-2.5 2 .7.6 1.5 1 2.5 1s1.8-.4 2.5-1C8 7.8 7 7 6 7z" opacity=".7"/></svg>
            有機野菜
        </span>
    )
}

/** 目玉商品バッジ */
const MedamaBadge = ({ size = 'normal' }: { size?: 'small' | 'normal' }) => {
    if (size === 'small') {
        return (
            <span className="inline-flex items-center bg-gradient-to-r from-red-500 to-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow z-10">
                目玉!!
            </span>
        )
    }
    return (
        <span className="absolute top-2 right-2 inline-flex items-center bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md z-10 ring-1 ring-white/30 animate-pulse">
            目玉商品!!
        </span>
    )
}

/** オススメバッジ */
const OsusumeBadge = ({ wakeari }: { wakeari: boolean }) => (
    <span className={`absolute ${wakeari ? 'top-9' : 'top-2'} right-2 inline-flex items-center gap-0.5 bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 text-[10px] font-bold px-2 py-1 rounded-full shadow-md z-10 ring-1 ring-white/30`}>
        <svg viewBox="0 0 12 12" className="w-3 h-3 fill-current"><path d="M6 1l1.5 3.2L11 4.8 8.5 7.1l.6 3.4L6 8.8 2.9 10.5l.6-3.4L1 4.8l3.5-.6z"/></svg>
        オススメ！
    </span>
)

const LocalProductCard = ({ product, onAddToCart, compact = false }: LocalProductCardProps) => {
    const [quantity, setQuantity] = useState(1)

    const increase = () => setQuantity(prev => Math.min(prev + 1, 99))
    const decrease = () => setQuantity(prev => Math.max(prev - 1, 1))

    const handleAdd = () => {
        onAddToCart(product, quantity)
        setQuantity(1)
    }

    const basePrice = Math.round(parseFloat(product.retail_price))
    const isOrganic = product.farming_method === 'organic'
    const priceValidUntil = calcPriceValidUntil(product.info_confirmed_at)
    const stale = isStale(product.info_confirmed_at)
    const retailWeight = getRetailWeight(product)
    const retailStock = getRetailStock(product)

    // コンパクト表示（横長リスト）
    if (compact) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex">
                <Link to={`/local/retail-products/${product.id}`} className="w-24 h-24 bg-gray-100 flex-shrink-0 relative">
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                            loading="lazy"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                            No Image
                        </div>
                    )}
                    {isOrganic && (
                        <span className="absolute top-1 left-1 z-10"><OrganicBadge size="small" /></span>
                    )}
                    {(product.is_medama || 0) === 1 && (
                        <span className="absolute top-1 right-1 z-10"><MedamaBadge size="small" /></span>
                    )}
                </Link>
                <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                        <Link to={`/local/retail-products/${product.id}`}>
                            <h3 className="text-sm font-bold text-gray-900 line-clamp-1 hover:text-emerald-600 transition-colors">
                                {product.name}
                            </h3>
                        </Link>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-lg font-bold text-emerald-600">
                                ¥{basePrice.toLocaleString()}
                                <span className="text-xs text-gray-500 ml-1">(税抜) / {product.retail_unit}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                            {retailWeight != null && <span>{retailWeight}g</span>}
                            {retailStock != null && <span>残り{retailStock}{product.retail_unit}</span>}
                            {priceValidUntil && <span>{priceValidUntil}まで</span>}
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                            <button type="button" onClick={decrease} className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50" aria-label="数量を減らす"><Minus size={16} /></button>
                            <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                            <button type="button" onClick={increase} className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50" aria-label="数量を増やす"><Plus size={16} /></button>
                        </div>
                        <button type="button" onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-md transition-colors">追加</button>
                    </div>
                </div>
            </div>
        )
    }

    // 通常表示（グリッド）
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <Link to={`/local/retail-products/${product.id}`} className="block">
                <div className="h-40 bg-gray-100 relative">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover hover:opacity-90 transition-opacity" loading="lazy" />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">No Image</div>
                    )}
                    {isOrganic && <OrganicBadge />}
                    {(product.is_medama || 0) === 1 && <MedamaBadge />}
                    {product.is_featured === 1 && <OsusumeBadge wakeari={(product.is_medama || 0) === 1} />}
                </div>
            </Link>
            <div className="p-4 space-y-2">
                <Link to={`/local/retail-products/${product.id}`}>
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-emerald-600 transition-colors">
                        {product.name}
                    </h3>
                </Link>
                <div>
                    <p className="text-xl font-bold text-emerald-600">¥{basePrice.toLocaleString()}<span className="text-xs font-normal text-gray-500 ml-1">(税抜)</span></p>
                    <p className="text-xs text-gray-500">/ {product.retail_unit}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    {retailWeight != null && <span>{retailWeight}g</span>}
                    {retailStock != null && <span>残り {retailStock}{product.retail_unit}</span>}
                    {priceValidUntil && <span>{priceValidUntil}までの価格</span>}
                </div>
                {product.is_wakeari === 1 && (
                    <p className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">規格外品などのためお安く提供しています</p>
                )}
                {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                )}
                {stale && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">在庫がなくなっている恐れがございます</p>
                )}
                <div className="flex items-center justify-center space-x-3 py-2">
                    <button type="button" onClick={decrease} className="p-2 rounded-full border-2 border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-emerald-500 transition-colors" aria-label="数量を減らす"><Minus size={18} /></button>
                    <span className="w-12 text-center text-lg font-semibold">{quantity}</span>
                    <button type="button" onClick={increase} className="p-2 rounded-full border-2 border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-emerald-500 transition-colors" aria-label="数量を増やす"><Plus size={18} /></button>
                </div>
                <button type="button" onClick={handleAdd} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-md transition-colors">カートに追加</button>
            </div>
        </div>
    )
}

export default LocalProductCard
