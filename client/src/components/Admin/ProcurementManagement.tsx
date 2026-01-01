import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productApi } from '@/services/api'
import { Product, FarmingMethod } from '@/types'
import { Star, Loader2, Download, Edit, Plus } from 'lucide-react'
import Loading from '@/components/Loading'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

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

    const handleDownloadCSV = () => {
        if (!productsData?.items) return;

        const headers = [
            '野菜名', '品種', '規格(単位)', '重量(g)', '農家名',
            '販売価格', 'ステータス', '栽培方法', '備考/おすすめの食べ方', '画像URL'
        ];

        const csvContent = [
            headers.join(','),
            ...productsData.items.map(p => {
                const status = p.is_active ? '販売中' : '停止中';
                // Escape quotes
                const escape = (s: string | undefined | null) => `"${(s || '').replace(/"/g, '""')}"`;

                return [
                    escape(p.name),
                    escape(p.variety),
                    escape(p.unit),
                    p.weight || '',
                    escape(`ID:${p.farmer_id}`), // Ideally fetch farmer name, but mostly ID is available
                    p.price,
                    status,
                    escape(p.farming_method),
                    escape(p.description),
                    escape(p.image_url)
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
            <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold">商品管理</h2>
                    <p className="text-sm text-gray-600 mt-1">商品の編集・CSV出力が可能です</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <Download size={18} />
                        CSV保存
                    </button>
                    <Link
                        to="/producer/products/new?farmer_id=1" // Default to farmer 1 for now
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={18} />
                        新規登録
                    </Link>
                </div>
            </div>

            <div className="p-4 border-b">
                <input
                    type="text"
                    placeholder="商品名で検索..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品名/品種</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">規格/重量</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">価格</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">栽培</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">おすすめ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredProducts.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <Link
                                        to={`/producer/products/${product.id}/edit?farmer_id=${product.farmer_id}`}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        <Edit size={20} />
                                    </Link>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden">
                                        {product.image_url && <img src={product.image_url} alt="" className="w-full h-full object-cover" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    <div>{product.name}</div>
                                    <div className="text-xs text-gray-500">{product.variety}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    <div>{product.unit}</div>
                                    {product.weight && <div className="text-xs">{product.weight}g</div>}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    ¥{Number(product.price).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-center text-sm">
                                    {product.farming_method === FarmingMethod.ORGANIC ?
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">有機</span> :
                                        <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">慣行</span>
                                    }
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
