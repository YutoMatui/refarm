import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orderApi, farmerApi } from '@/services/api'
import { Download, Filter, Calendar } from 'lucide-react'
import { format, addDays } from 'date-fns' // date-fnsを利用
import Loading from '@/components/Loading'

export default function ProcurementManagement() {
    const [filterText, setFilterText] = useState('')
    const [selectedFarmerId, setSelectedFarmerId] = useState<number | 'all'>('all')

    // 【修正】date-fnsを使用してローカル時間で正確に「明日」を取得
    const [selectedDate, setSelectedDate] = useState(() =>
        format(addDays(new Date(), 1), 'yyyy-MM-dd')
    )

    // APIが「飲食店」+「消費者」の合算値を返してくれる前提
    const { data: aggregationData, isLoading } = useQuery({
        queryKey: ['procurement-aggregation', selectedDate],
        queryFn: async () => {
            return await orderApi.getDailyAggregation(selectedDate)
        },
        enabled: !!selectedDate
    })

    const { data: farmersData } = useQuery({
        queryKey: ['admin-farmers-list'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 1000 });
            return response.data;
        }
    });

    const handleDownloadCSV = () => {
        if (!aggregationData) return;

        const headers = [
            '配送日', '生産者ID', '生産者名', '商品名', '合計数量', '単位'
        ];

        const rows: string[] = [];
        aggregationData.forEach(farmer => {
            farmer.products.forEach(product => {
                // CSVエスケープ処理
                const escape = (s: string | undefined | null) => `"${(s || '').replace(/"/g, '""')}"`;
                rows.push([
                    selectedDate,
                    farmer.farmer_id,
                    escape(farmer.farmer_name),
                    escape(product.product_name),
                    product.quantity,
                    escape(product.unit)
                ].join(','));
            });
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        // Excelで文字化けしないようBOMを付与
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `procurement_${selectedDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredAggregation = useMemo(() => {
        if (!aggregationData) return []
        return aggregationData.filter(farmer => {
            const matchesFarmer = selectedFarmerId === 'all' || farmer.farmer_id === selectedFarmerId;
            if (!matchesFarmer) return false;

            if (!filterText) return true;

            return farmer.products.some(p =>
                p.product_name.includes(filterText)
            );
        }).map(farmer => {
            if (filterText) {
                return {
                    ...farmer,
                    products: farmer.products.filter(p => p.product_name.includes(filterText))
                };
            }
            return farmer;
        }).filter(farmer => farmer.products.length > 0);
    }, [aggregationData, filterText, selectedFarmerId])

    const totalStats = useMemo(() => {
        if (!filteredAggregation) return { farmerCount: 0, productTypeCount: 0, totalItems: 0 };

        const farmerCount = filteredAggregation.length;
        let productTypeCount = 0;
        let totalItems = 0;

        filteredAggregation.forEach(farmer => {
            productTypeCount += farmer.products.length;
            farmer.products.forEach(product => {
                totalItems += Number(product.quantity) || 0;
            });
        });

        return { farmerCount, productTypeCount, totalItems };
    }, [filteredAggregation]);

    if (isLoading) return <Loading message="仕入れデータを読み込み中..." />

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold">仕入れ集計（全注文統合版）</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        飲食店および個人注文の合計仕入れ必要数を確認できます
                    </p>
                </div>
                <button
                    onClick={handleDownloadCSV}
                    disabled={!aggregationData || aggregationData.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                >
                    <Download size={18} />
                    CSV出力
                </button>
            </div>

            {/* Stats Cards */}
            <div className="p-6 border-b bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <div className="text-sm text-gray-600">生産者数</div>
                        <div className="text-2xl font-bold text-gray-900">{totalStats.farmerCount} 件</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <div className="text-sm text-gray-600">商品種類数</div>
                        <div className="text-2xl font-bold text-blue-600">{totalStats.productTypeCount} 種類</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <div className="text-sm text-gray-600">合計数量</div>
                        <div className="text-2xl font-bold text-green-600">{totalStats.totalItems} 点</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
                <div className="sm:w-64">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="date"
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="商品名で絞り込み..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                </div>
                <div className="sm:w-64">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm appearance-none bg-white cursor-pointer"
                            value={selectedFarmerId}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedFarmerId(val === 'all' ? 'all' : Number(val));
                            }}
                        >
                            <option value="all">全ての生産者</option>
                            {farmersData?.items.map((f: any) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r w-[25%]">生産者</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r w-[45%]">商品名</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase border-r w-[15%]">数量</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-[15%]">単位</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredAggregation.map((farmer) => (
                            farmer.products.map((product, idx) => (
                                <tr key={`${farmer.farmer_id}-${product.product_name}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                    {idx === 0 && (
                                        <td
                                            className="px-6 py-4 text-sm font-bold text-gray-900 bg-white border-r align-top"
                                            rowSpan={farmer.products.length}
                                        >
                                            <div className="sticky top-0">
                                                {farmer.farmer_name}
                                                <div className="text-xs text-gray-400 font-normal mt-1">ID: {farmer.farmer_id}</div>
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-sm text-gray-900 border-r">
                                        {product.product_name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-bold text-gray-900 border-r">
                                        {product.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-center text-gray-600">
                                        {product.unit}
                                    </td>
                                </tr>
                            ))
                        ))}
                    </tbody>
                </table>
                {filteredAggregation.length === 0 && (
                    <div className="text-center py-16 text-gray-500 bg-gray-50">
                        <p className="text-lg font-medium">指定日の注文が見つかりません</p>
                        <p className="text-sm mt-2">日付を変更するか、注文が入るのをお待ちください</p>
                    </div>
                )}
            </div>
        </div>
    )
}