import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TrendingUp, DollarSign, ShoppingBag, Download, Loader2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { producerApi } from '../../services/api';

type SalesData = {
    totalSales: number;
    lastMonthSales: number;
    totalOrders: number;
    avgOrderPrice: number;
    dailySales: { day: number; amount: number }[];
    topProducts: { name: string; amount: number; count: number }[];
};

export default function ProducerSales() {
    const { farmerId } = useOutletContext<{ farmerId: number }>();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true);
            try {
                const monthStr = format(currentMonth, 'yyyy-MM');
                const response = await producerApi.getSales(farmerId, monthStr);
                setData(response.data);
            } catch (error) {
                console.error("Failed to fetch sales data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSales();
    }, [currentMonth, farmerId]);

    const nextMonth = () => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() + 1);
        setCurrentMonth(d);
    };

    const prevMonth = () => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - 1);
        setCurrentMonth(d);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(val);
    };

    if (loading) {
        return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-green-600" /></div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-gray-500">データが読み込めませんでした</div>;
    }

    const maxDaily = Math.max(...data.dailySales.map(d => d.amount), 1); // Avoid div by zero

    // Calculate growth rate
    const growthRate = data.lastMonthSales > 0
        ? ((data.totalSales - data.lastMonthSales) / data.lastMonthSales * 100).toFixed(1)
        : data.totalSales > 0 ? '100.0' : '0.0';
    const isPositive = parseFloat(growthRate) >= 0;

    const handleDownloadCSV = () => {
        if (!data) return;

        // Header
        const headers = ['日付', '売上金額'];
        const rows = data.dailySales.map(d => [`${currentMonth.getFullYear()}/${currentMonth.getMonth() + 1}/${d.day}`, d.amount]);

        // Add total
        rows.push(['合計', data.totalSales]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `sales_${format(currentMonth, 'yyyyMM')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPaymentNotice = () => {
        // Mock payment notice download
        alert('支払通知書(PDF)の発行機能は準備中です。\n本来はここでサーバーからPDFをダウンロードします。');
    };

    return (
        <div className="space-y-6 pb-20">
            <h2 className="text-xl font-bold flex items-center">
                <TrendingUp className="mr-2" />
                売上レポート
            </h2>

            {/* Month Selector */}
            <div className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                    <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                    <div className="text-sm text-gray-500">対象期間</div>
                    <div className="text-lg font-bold">
                        {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                    </div>
                </div>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow border-l-4 border-green-500">
                    <div className="text-xs text-gray-500 mb-1 flex items-center">
                        <DollarSign size={14} className="mr-1" />
                        月間売上
                    </div>
                    <div className="text-xl font-bold text-gray-800">
                        {formatCurrency(data.totalSales)}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        先月比 {isPositive ? '+' : ''}{growthRate}%
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow border-l-4 border-blue-500">
                    <div className="text-xs text-gray-500 mb-1 flex items-center">
                        <ShoppingBag size={14} className="mr-1" />
                        注文数
                    </div>
                    <div className="text-xl font-bold text-gray-800">
                        {data.totalOrders}件
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        平均単価: {formatCurrency(data.avgOrderPrice)}
                    </div>
                </div>
            </div>

            {/* Daily Sales Chart */}
            <div className="bg-white p-4 rounded-xl shadow">
                <h3 className="font-bold text-gray-800 mb-4 text-sm">日別売上推移</h3>
                <div className="h-40 flex items-end justify-between space-x-1">
                    {data.dailySales.map((d, i) => (
                        <div key={d.day} className="flex-1 flex flex-col items-center group relative">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                {d.day}日: {formatCurrency(d.amount)}
                            </div>
                            <div
                                className="w-full bg-green-200 hover:bg-green-400 transition-colors rounded-t-sm"
                                style={{ height: `${(d.amount / maxDaily) * 100}%` }}
                            ></div>
                            {i % 5 === 0 && (
                                <div className="text-[10px] text-gray-400 mt-1">{d.day}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Sales Table (Details) */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 text-sm">日別売上詳細</h3>
                </div>
                <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="px-4 py-2 text-left">日付</th>
                                <th className="px-4 py-2 text-right">売上金額</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.dailySales.map(d => (
                                <tr key={d.day}>
                                    <td className="px-4 py-2">{d.day}日</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(d.amount)}</td>
                                </tr>
                            ))}
                            {data.dailySales.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="px-4 py-4 text-center text-gray-400">データがありません</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Product Ranking */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-sm">商品別売上ランキング</h3>
                </div>
                <div>
                    {data.topProducts.length > 0 ? (
                        data.topProducts.map((p, i) => (
                            <div key={p.name} className="flex items-center p-4 border-b border-gray-50 last:border-0">
                                <div className={`
                                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3
                                    ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                        i === 1 ? 'bg-gray-100 text-gray-700' :
                                            i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500'}
                                `}>
                                    {i + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-sm text-gray-800">{p.name}</div>
                                    <div className="text-xs text-gray-500">{p.count}点販売</div>
                                </div>
                                <div className="font-bold text-gray-800 text-sm">
                                    {formatCurrency(p.amount)}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-4 text-center text-gray-400 text-sm">
                            データがありません
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <button
                    onClick={handleDownloadCSV}
                    className="w-full py-3 bg-gray-800 text-white rounded-lg flex items-center justify-center font-bold shadow-lg active:scale-95 transition-transform"
                >
                    <Download size={18} className="mr-2" />
                    売上CSVをダウンロード
                </button>
                <button
                    onClick={handleDownloadPaymentNotice}
                    className="w-full py-3 bg-white border border-green-600 text-green-700 rounded-lg flex items-center justify-center font-bold shadow-sm active:bg-green-50 transition-colors"
                >
                    <FileText size={18} className="mr-2" />
                    支払通知書を発行 (Refarm)
                </button>
            </div>
        </div>
    );
}
