import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productApi, farmerApi, uploadApi } from '@/services/api'
import { Product, StockType, ProductCategory, TaxRate } from '@/types'
import { Plus, Edit2, Save, X, Upload, Search } from 'lucide-react'
import Loading from '@/components/Loading'
import ImageCropperModal from '@/components/ImageCropperModal'

export default function ProductManagement() {
    const queryClient = useQueryClient()
    const [cropImage, setCropImage] = useState<string | null>(null)
    const [targetId, setTargetId] = useState<number | null>(null)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [search, setSearch] = useState('')

    const { data } = useQuery({
        queryKey: ['admin-products', search],
        queryFn: async () => {
            const response = await productApi.list({ limit: 1000, search })
            return response.data
        },
    })

    // Fetch Farmers for Dropdown
    const { data: farmersData } = useQuery({
        queryKey: ['admin-farmers-list'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 1000 })
            return response.data
        }
    })
    const farmers = farmersData?.items || []

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (data: Partial<Product>) => {
            const response = await productApi.create(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-products'] })
            setIsModalOpen(false)
            alert('商品を登録しました')
        },
        onError: () => alert('登録に失敗しました')
    })

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<Product> }) => {
            const response = await productApi.update(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-products'] })
            setIsModalOpen(false)
            alert('更新しました')
        },
        onError: () => alert('更新に失敗しました')
    })

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, productId: number) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0]
            const reader = new FileReader()
            reader.addEventListener('load', () => {
                setCropImage(reader.result as string)
                setTargetId(productId)
            })
            reader.readAsDataURL(file)
            e.target.value = ''
        }
    }

    const handleCropComplete = async (blob: Blob) => {
        if (!targetId) return
        try {
            const file = new File([blob], "product.jpg", { type: "image/jpeg" })
            const uploadResponse = await uploadApi.uploadImage(file)
            await productApi.update(targetId, { image_url: uploadResponse.data.url })
            alert('画像を更新しました')
            queryClient.invalidateQueries({ queryKey: ['admin-products'] })
            setCropImage(null)
            setTargetId(null)
        } catch (error) {
            console.error('Upload failed:', error)
            alert('アップロードに失敗しました')
        }
    }

    const openCreateModal = () => {
        setEditingProduct(null)
        setIsModalOpen(true)
    }

    const openEditModal = (product: Product) => {
        setEditingProduct(product)
        setIsModalOpen(true)
    }

    const products = data?.items || []

    return (
        <>
            <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold">商品・在庫管理</h2>
                        <p className="text-sm text-gray-600 mt-1">在庫数・価格・販売状態を編集できます</p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="商品名で検索..."
                                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={openCreateModal}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            野菜追加
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品名・農家</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種別</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">価格(税抜)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">在庫</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {products.map((product) => {
                                const isKobe = product.stock_type === StockType.KOBE
                                const farmer = farmers.find(f => f.id === product.farmer_id)

                                return (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="relative group w-12 h-12">
                                                <img
                                                    src={product.image_url || 'https://placehold.co/100x100?text=No+Image'}
                                                    alt={product.name}
                                                    className="w-12 h-12 rounded object-cover bg-gray-100"
                                                />
                                                <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded cursor-pointer">
                                                    <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => handleFileSelect(e, product.id)}
                                                    />
                                                </label>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                            <div className="text-xs text-gray-500">{farmer?.name || `農家ID:${product.farmer_id}`} / {product.unit}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={isKobe ? 'badge-kobe' : 'badge-other'}>
                                                {isKobe ? '神戸野菜' : 'その他'}
                                            </span>
                                            <div className="text-[10px] text-gray-500 mt-1">{product.category}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            ¥{parseInt(product.price).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {isKobe ? (
                                                <span className="text-sm font-medium">{product.stock_quantity ?? 0}</span>
                                            ) : (
                                                <span className="text-xs text-gray-500">無制限</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded-full ${product.is_active === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {product.is_active === 1 ? '販売中' : '停止'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => openEditModal(product)}
                                                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" /> 編集
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <ProductModal
                    product={editingProduct}
                    farmers={farmers}
                    onClose={() => setIsModalOpen(false)}
                    onSave={(data) => {
                        if (editingProduct) {
                            updateMutation.mutate({ id: editingProduct.id, data })
                        } else {
                            createMutation.mutate(data)
                        }
                    }}
                    isSaving={createMutation.isPending || updateMutation.isPending}
                />
            )}

            {cropImage && (
                <ImageCropperModal
                    imageSrc={cropImage}
                    onCancel={() => {
                        setCropImage(null)
                        setTargetId(null)
                    }}
                    onCropComplete={handleCropComplete}
                    aspectRatio={1}
                    title="商品画像の編集"
                />
            )}
        </>
    )
}

function ProductModal({
    product,
    farmers,
    onClose,
    onSave,
    isSaving
}: {
    product: Product | null,
    farmers: any[],
    onClose: () => void,
    onSave: (data: Partial<Product>) => void,
    isSaving: boolean
}) {
    const [formData, setFormData] = useState<Partial<Product>>({
        name: product?.name || '',
        farmer_id: product?.farmer_id || (farmers.length > 0 ? farmers[0].id : undefined),
        price: product?.price || '',
        cost_price: product?.cost_price || 0,
        unit: product?.unit || '個',
        description: product?.description || '',
        stock_type: product?.stock_type || StockType.KOBE,
        category: product?.category || ProductCategory.FRUIT_VEG,
        stock_quantity: product?.stock_quantity ?? 0,
        is_active: product?.is_active ?? 1,
        tax_rate: product?.tax_rate || TaxRate.REDUCED,
        display_order: product?.display_order || 0,
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave(formData)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h3 className="text-xl font-bold">{product ? '商品情報を編集' : '新規商品登録'}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">商品名 *</label>
                            <input
                                required
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">農家 *</label>
                            <select
                                className="w-full border rounded-md p-2"
                                value={formData.farmer_id}
                                onChange={e => setFormData({ ...formData, farmer_id: Number(e.target.value) })}
                            >
                                {farmers.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                            <select
                                className="w-full border rounded-md p-2"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                            >
                                <option value={ProductCategory.LEAFY}>葉物野菜</option>
                                <option value={ProductCategory.ROOT}>根菜類</option>
                                <option value={ProductCategory.FRUIT_VEG}>果菜類</option>
                                <option value={ProductCategory.MUSHROOM}>きのこ類</option>
                                <option value={ProductCategory.HERB}>ハーブ・香辛料</option>
                                <option value={ProductCategory.OTHER}>その他</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">売価(税抜)</label>
                            <input
                                type="number"
                                required
                                className="w-full border rounded-md p-2"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                placeholder="円"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">卸値</label>
                            <input
                                type="number"
                                className="w-full border rounded-md p-2"
                                value={formData.cost_price}
                                onChange={e => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                                placeholder="円"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">単位</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={formData.unit}
                                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                placeholder="個、束、袋..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">在庫種別</label>
                            <select
                                className="w-full border rounded-md p-2"
                                value={formData.stock_type}
                                onChange={e => setFormData({ ...formData, stock_type: e.target.value as StockType })}
                            >
                                <option value={StockType.KOBE}>神戸野菜 (在庫管理あり)</option>
                                <option value={StockType.OTHER}>その他 (市場品)</option>
                            </select>
                        </div>

                        {formData.stock_type === StockType.KOBE && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">在庫数</label>
                                <input
                                    type="number"
                                    className="w-full border rounded-md p-2"
                                    value={formData.stock_quantity}
                                    onChange={e => setFormData({ ...formData, stock_quantity: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                            <select
                                className="w-full border rounded-md p-2"
                                value={formData.is_active}
                                onChange={e => setFormData({ ...formData, is_active: Number(e.target.value) })}
                            >
                                <option value={1}>販売中</option>
                                <option value={0}>停止中</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">商品説明</label>
                        <textarea
                            className="w-full border rounded-md p-2"
                            rows={3}
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white p-4 -mx-6 -mb-6 shadow-top">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? <Loading message="" /> : <Save className="w-4 h-4" />}
                            保存する
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
