import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productApi } from '@/services/api'
import { Product } from '@/types'
import Loading from '@/components/Loading'
import ProductCard from '@/components/ProductCard'
import { Search, ShoppingBag, List, Star, Sparkles } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'

type TabType = 'recommend' | 'all' | 'wakeari' | 'new'

export default function ProductSearchLayout() {
    const [activeTab, setActiveTab] = useState<TabType>('recommend')
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearchQuery = useDebounce(searchQuery, 500)

    // Fetch Products based on Tab
    const { data: productData, isLoading } = useQuery({
        queryKey: ['products', activeTab, debouncedSearchQuery],
        queryFn: async () => {
            const params: any = { is_active: 1, limit: 100 }
            if (debouncedSearchQuery) params.search = debouncedSearchQuery

            switch (activeTab) {
                case 'recommend':
                    params.is_featured = 1
                    break
                case 'wakeari':
                    params.is_wakeari = 1
                    break
                case 'new':
                    // Assuming API supports sort by created_at or we simulate it
                    // API param might need adjustment
                    break
                default:
                    // 'all' - no extra filters
                    break
            }

            const response = await productApi.list(params)
            return response.data
        },
    })

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Sticky Header with Search and Tabs */}
            <div className="sticky top-0 z-30 bg-white shadow-sm">
                {/* Search Bar */}
                <div className="px-4 py-3 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="野菜名、農家名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-green-500 text-sm"
                        />
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex overflow-x-auto no-scrollbar border-b border-gray-100">
                    <TabButton
                        active={activeTab === 'recommend'}
                        onClick={() => setActiveTab('recommend')}
                        icon={Star}
                        label="おすすめ"
                    />
                    <TabButton
                        active={activeTab === 'all'}
                        onClick={() => setActiveTab('all')}
                        icon={List}
                        label="野菜一覧"
                    />
                    <TabButton
                        active={activeTab === 'wakeari'}
                        onClick={() => setActiveTab('wakeari')}
                        icon={ShoppingBag}
                        label="訳あり"
                    />
                    <TabButton
                        active={activeTab === 'new'}
                        onClick={() => setActiveTab('new')}
                        icon={Sparkles}
                        label="新着"
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 pb-32"> {/* Extra padding for FAB */}
                {isLoading ? (
                    <Loading message="商品を読み込み中..." />
                ) : (
                    <>
                        {(!productData?.items || productData.items.length === 0) ? (
                            <div className="text-center py-20 text-gray-500">
                                <p>条件に一致する野菜が見つかりませんでした。</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {productData.items.map((product: Product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center justify-center py-3 min-w-[80px] border-b-2 transition-all ${active
                    ? 'border-green-600 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-500 hover:bg-gray-50'
                }`}
        >
            <Icon size={20} className={`mb-1 ${active ? 'fill-current' : ''}`} />
            <span className="text-xs font-bold whitespace-nowrap">{label}</span>
        </button>
    )
}
