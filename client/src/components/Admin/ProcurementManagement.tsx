import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productApi, farmerApi } from '@/services/api'
import { Download, Filter } from 'lucide-react'
import Loading from '@/components/Loading'

export default function ProcurementManagement() {
    const [filterText, setFilterText] = useState('')
    const [selectedFarmerId, setSelectedFarmerId] = useState<number | 'all'>('all')
    const [] = useState('')
    const [] = useState('')

    const { data: productsData, isLoading } = useQuery({
        queryKey: ['admin-products'],
        queryFn: async () => {
            const response = await productApi.list({ limit: 1000 })
            return response.data
        },
    })

    const { data: farmersData } = useQuery({
        queryKey: ['admin-farmers-list'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 1000 });
            return response.data;
        }
    });

    const handleDownloadCSV = () => {
        if (!productsData?.items) return;

        const headers = [
            '商品ID', '商品名', '品種', '生産者ID', '生産者名',
            '仕入れ値', '販売価格(税抜)', '在庫数', '単位', '重量(g)'
        ];

        const csvContent = [
            headers.join(','),
            ...filteredProducts.map(p => {
                const escape = (s: string | undefined | null) => `"${(s || '').replace(/"/g, '""')}"`;
                const farmerName = farmersData?.items.find(f => f.id === p.farmer_id)?.name || '';

                return [
                    p.id,
                    escape(p.name),
                    escape(p.variety),
                    p.farmer_id || '',
                    escape(farmerName),
                    p.cost_price || '',
                    p.price,
                    p.stock_quantity || '',
                    escape(p.unit),
                    p.weight || ''
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `procurement_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredProducts = useMemo(() => {
        if (!productsData?.items) return []
        return productsData.items.filter(p => {
            const matchesText = p.name.includes(filterText) || (p.description && p.description.includes(filterText));
            const matchesFarmer = selectedFarmerId === 'all' || p.farmer_id === selectedFarmerId;
            return matchesText && matchesFarmer;
        })
    }, [productsData, filterText, selectedFarmerId])

    const totalStats = useMemo(() => {
        const totalCost = filteredProducts.reduce((sum, p) => sum + (Number(p.cost_price) || 0), 0);
        const totalPrice = filteredProducts.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
        const productCount = filteredProducts.length;
        return { totalCost, totalPrice, productCount };
    }, [filteredProducts]);

    if (isLoading) return <Loading message="仕入れデータを読み込み中..." />

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold">仕入れ集計</h2>
                    <p className="text-sm text-gray-600 mt-1">商品の仕入れ状況を確認・CSV出力が可能です</p>
                </div>
                <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <Download size={18} />
                    CSV出力
                </button>
            </div>

            {/* Stats Cards */}
            <div className="p-6 border-b bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600">合計商品数</div>
                        <div className="text-2xl font-bold text-gray-900">{totalStats.productCount} 点</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600">仕入れ値合計</div>
                        <div className="text-2xl font-bold text-blue-600">¥{totalStats.totalCost.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600">販売価格合計(税抜)</div>
                        <div className="text-2xl font-bold text-green-600">¥{totalStats.totalPrice.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="商品名で検索..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                </div>
                <div className="sm:w-64">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm appearance-none bg-white"
                            value={selectedFarmerId}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedFarmerId(val === 'all' ? 'all' : Number(val));
                            }}
                        >
                            <option value="all">全ての生産者</option>
                            {farmersData?.items.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品名/品種</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">生産者</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">仕入れ値</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">販売価格(税抜)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">在庫数</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">単位</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredProducts.map((product) => {
                            const farmer = farmersData?.items.find(f => f.id === product.farmer_id);
                            return (
                                <tr key={product.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-500">{product.id}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        <div>{product.name}</div>
                                        {product.variety && <div className="text-xs text-gray-500">{product.variety}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {farmer?.name || `ID: ${product.farmer_id}`}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-medium text-blue-600">
                                        {product.cost_price ? `¥${Number(product.cost_price).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-medium text-green-600">
                                        ¥{Number(product.price).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                                        {product.stock_quantity ?? '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-center text-gray-600">
                                        {product.unit}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
