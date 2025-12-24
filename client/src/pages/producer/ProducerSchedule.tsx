import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, Truck, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { producerApi } from '../../services/api';

// Data type
type ScheduleItem = {
    id: string;
    name: string;
    amount: number;
    unit: string;
    type: 'shipping' | 'preparation';
    time?: string;
};

export default function ProducerSchedule() {
    const { farmerId } = useOutletContext<{ farmerId: number }>();
    const [currentDate, setCurrentDate] = useState(new Date()); // Represents the currently displayed month
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch data when selectedDate or farmerId changes
    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const response = await producerApi.getSchedule(farmerId, dateStr);
                setItems(response.data);
            } catch (error) {
                console.error("Failed to fetch schedule:", error);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [selectedDate, farmerId]);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Generate days for the full month view
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Calculate padding days for grid alignment (start on correct weekday)
    const startDayOfWeek = monthStart.getDay(); // 0 (Sun) to 6 (Sat)

    // Grid alignment
    const emptyStartDays = Array.from({ length: startDayOfWeek });

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center">
                <CalendarIcon className="mr-2" />
                出荷・準備スケジュール
            </h2>

            {/* Monthly Calendar */}
            <div className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-bold text-lg">
                        {format(currentDate, 'yyyy年M月', { locale: ja })}
                    </span>
                    <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                        <div key={d} className="text-xs text-gray-400 font-medium">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1 auto-rows-fr">
                    {emptyStartDays.map((_, i) => <div key={`empty-${i}`} />)}

                    {daysInMonth.map((day) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <button
                                key={day.toString()}
                                onClick={() => setSelectedDate(day)}
                                className={`
                                    flex flex-col items-center p-2 rounded-lg transition-colors relative h-14 justify-start
                                    ${isSelected ? 'bg-green-600 text-white shadow-md' : 'hover:bg-gray-50 text-gray-700'}
                                    ${isToday && !isSelected ? 'text-green-600 font-bold border border-green-200' : ''}
                                `}
                            >
                                <span className={`text-sm ${isSelected ? 'font-bold' : ''}`}>
                                    {format(day, 'd')}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Daily Details */}
            <div className="bg-white rounded-xl shadow overflow-hidden min-h-[300px]">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold flex items-center">
                        {format(selectedDate, 'M月d日 (E)', { locale: ja })} の予定
                    </h3>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                        {loading ? '...' : `${items.length}件のタスク`}
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="animate-spin text-green-600" />
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {items.length > 0 ? (
                            items.map((item) => (
                                <div key={item.id} className="p-4 flex items-center">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center mr-4 flex-shrink-0
                                        ${item.type === 'shipping' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}
                                    `}>
                                        {item.type === 'shipping' ? <Truck size={20} /> : <Package size={20} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center mb-1">
                                            <span className={`
                                                text-xs font-bold px-2 py-0.5 rounded mr-2
                                                ${item.type === 'shipping' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'}
                                            `}>
                                                {item.type === 'shipping' ? '出荷' : '準備'}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-gray-800">{item.name}</h4>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xl font-bold text-gray-800">{item.amount}</span>
                                        <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                予定はありません
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
