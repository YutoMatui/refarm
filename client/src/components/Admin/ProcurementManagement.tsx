import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { FarmerAggregation, AggregatedProduct } from '@/types'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, addDays, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import Loading from '@/components/Loading'

export default function ProcurementManagement() {
    const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly')
    const [targetDate, setTargetDate] = useState(new Date())

    // API needs YYYY-MM for monthly, YYYY-MM-DD for daily
    const formattedDate = viewMode === 'monthly' ? format(targetDate, 'yyyy-MM') : format(targetDate, 'yyyy-MM-dd')

    const { data, isLoading } = useQuery({
        queryKey: ['procurement', viewMode, formattedDate],
        queryFn: async () => {
            if (viewMode === 'monthly') {
                return await orderApi.getMonthlyAggregation(formattedDate)
            } else {
                return await orderApi.getDailyAggregation(formattedDate)
            }
        },
    })

    const handlePrev = () => {
        setTargetDate(prev => viewMode === 'monthly' ? subMonths(prev, 1) : subDays(prev, 1))
    }

    const handleNext = () => {
        setTargetDate(prev => viewMode === 'monthly' ? addMonths(prev, 1) : addDays(prev, 1))
    }

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            setTargetDate(new Date(e.target.value))
        }
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold">仕入れ集計</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        {viewMode === 'monthly' ? '月ごと' : '日ごと'}の農家別必要野菜数を確認できます
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex bg-gray-100 p-1 rounded-lg self-end">
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={`px-3 py-1 text-sm rounded-md transition-all ${viewMode === 'monthly' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            月次
                        </button>
                        <button
                            onClick={() => setViewMode('daily')}
                            className={`px-3 py-1 text-sm rounded-md transition-all ${viewMode === 'daily' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            日次
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1">
                        <button onClick={handlePrev} className="p-1 hover:bg-gray-100 rounded">
                            <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>

                        <div className="flex items-center gap-2 px-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            {viewMode === 'monthly' ? (
                                <span className="text-sm font-medium">
                                    {format(targetDate, 'yyyy年MM月', { locale: ja })}
                                </span>
                            ) : (
                                <input
                                    type="date"
                                    value={format(targetDate, 'yyyy-MM-dd')}
                                    onChange={handleDateChange}
                                    className="text-sm focus:outline-none"
                                />
                            )}
                        </div>

                        <button onClick={handleNext} className="p-1 hover:bg-gray-100 rounded">
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <Loading message="集計中..." />
            ) : data && data.length > 0 ? (
                <div className="p-6 space-y-8">
                    {data.map((farmerGroup: FarmerAggregation, index: number) => (
                        <div key={index} className="border rounded-lg overflow-hidden">
                            <div className="bg-green-50 px-6 py-3 border-b flex justify-between items-center">
                                <h3 className="font-bold text-green-900 flex items-center gap-2">
                                    <span className="w-2 h-6 bg-green-600 rounded-full inline-block"></span>
                                    {farmerGroup.farmer_name}
                                </h3>
                            </div>
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-2/3">商品名</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase w-1/3">必要数量</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {farmerGroup.products.map((product: AggregatedProduct, pIndex: number) => (
                                        <tr key={pIndex} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm text-gray-900">{product.product_name}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                                                {product.quantity} <span className="text-xs font-normal text-gray-500">{product.unit}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-12 text-center text-gray-500">
                    <p className="text-lg mb-2">データがありません</p>
                    <p className="text-sm">
                        指定された{viewMode === 'monthly' ? '月' : '日'}（{
                            viewMode === 'monthly'
                                ? format(targetDate, 'yyyy年MM月', { locale: ja })
                                : format(targetDate, 'MM/dd', { locale: ja })
                        }）の配送予定はありません。
                    </p>
                </div>
            )}
        </div>
    )
}
