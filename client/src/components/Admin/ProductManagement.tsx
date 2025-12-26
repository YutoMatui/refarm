import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productApi } from '@/services/api'
import { Product } from '@/types'
import { Star, Loader2 } from 'lucide-react'
import Loading from '@/components/Loading'
import { toast } from 'sonner'

export default function ProductManagement() {
    const queryClient = useQueryClient()
    const [filterText, setFilterText] = useState('')

    const { data: productsData, isLoading } = useQuery({
        queryKey: ['admin-products'],
        queryFn: async () => {
            const response = await productApi.list({ limit: 1000 }) // Fetch all for admin
            return response.data
        },
    })

    const updateProductMutation = useMutation({
        mutationFn: async ({ id, isFeatured }: { id: number; isFeatured: number }) => {
            await productApi.update(id, { is_featured: isFeatured })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-products'] })
            toast.success('更新しました')
        },
        onError: () => {
            toast.error('更新に失敗しました')
        }
    })

    const handleToggleFeatured = (product: Product) => {
        const newValue = product.is_featured === 1 ? 0 : 1;
        updateProductMutation.mutate({ id: product.id, isFeatured: newValue });
    }

    const filteredProducts = useMemo(() => {
        if (!productsData?.items) return []
        return productsData.items.filter(p =>
            p.name.includes(filterText) ||
            (p.description && p.description.includes(filterText))
        )
    }, [productsData, filterText])

    if (isLoading) return <Loading message="商品情報を読み込み中..." />

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">商品管理 (おすすめ設定)</h2>
                    <p className="text-sm text-gray-600 mt-1">「旬のおすすめ食材」としてトップページに表示する商品を設定できます</p>
                </div>
                <input
                    type="text"
                    placeholder="商品名で検索..."
                    className="border border-gray-300 rounded-lg px-4 py-2 text-sm"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">価格</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">おすすめ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredProducts.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-900">#{product.id}</td>
                                <td className="px-6 py-4">
                                    <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden">
                                        {product.image_url && <img src={product.image_url} alt="" className="w-full h-full object-cover" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    {product.name}
                                    <div className="text-xs text-gray-500 font-normal">在庫: {product.stock_quantity}{product.unit}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    ¥{Number(product.price).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={() => handleToggleFeatured(product)}
                                        disabled={updateProductMutation.isPending}
                                        className={`p-2 rounded-full transition-colors ${product.is_featured
                                            ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                    >
                                        {updateProductMutation.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : <Star className={`w-5 h-5 ${product.is_featured ? 'fill-yellow-600' : ''}`} />}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
