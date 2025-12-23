import { useState } from 'react';
import { ChevronLeft, ChevronRight, Package, Truck, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';

// Mock data type
type ScheduleItem = {
    id: string;
    name: string;
    amount: number;
    unit: string;
    type: 'shipping' | 'preparation'; // 出荷 or 準備
    time?: string;
};

export default function ProducerSchedule() {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Mock data generator
    const getMockItems = (date: Date): ScheduleItem[] => {
        const day = date.getDate();
        // Generate deterministic mock data based on date
        if (day % 3 === 0) {
            return [
                { id: '1', name: 'キャベツ', amount: 50, unit: '玉', type: 'shipping', time: '08:00' },
                { id: '2', name: '人参', amount: 100, unit: '本', type: 'preparation' }
            ];
        } else if (day % 3 === 1) {
            return [
                { id: '3', name: 'トマト', amount: 30, unit: 'kg', type: 'shipping', time: '09:00' },
                { id: '4', name: 'きゅうり', amount: 40, unit: '本', type: 'shipping', time: '09:30' },
                { id: '5', name: 'ナス', amount: 20, unit: '袋', type: 'preparation' }
            ];
        }
        return [{ id: '6', name: '小松菜', amount: 30, unit: '束', type: 'preparation' }];
    };

    const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
    const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));

    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const weekDays = [...Array(7)].map((_, i) => addDays(startDate, i));

    const [selectedDate, setSelectedDate] = useState(new Date());

    const items = getMockItems(selectedDate);

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center">
                <CalendarIcon className="mr-2" />
                出荷・準備スケジュール
            </h2>

            {/* Weekly Calendar */}
            <div className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={prevWeek} className="p-1 hover:bg-gray-100 rounded-full">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-bold text-lg">
                        {format(startDate, 'yyyy年M月', { locale: ja })}
                    </span>
                    <button onClick={nextWeek} className="p-1 hover:bg-gray-100 rounded-full">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['月', '火', '水', '木', '金', '土', '日'].map(d => (
                        <div key={d} className="text-xs text-gray-400 font-medium">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((day) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isToday = isSameDay(day, new Date());
                        const hasEvent = day.getDate() % 3 !== 2; // Mock indicator

                        return (
                            <button
                                key={day.toString()}
                                onClick={() => setSelectedDate(day)}
                                className={`
                                    flex flex-col items-center p-2 rounded-lg transition-colors relative
                                    ${isSelected ? 'bg-green-600 text-white shadow-md' : 'hover:bg-gray-50 text-gray-700'}
                                    ${isToday && !isSelected ? 'text-green-600 font-bold border border-green-200' : ''}
                                `}
                            >
                                <span className={`text-sm ${isSelected ? 'font-bold' : ''}`}>
                                    {format(day, 'd')}
                                </span>
                                <div className="h-1 mt-1 flex gap-0.5">
                                    {hasEvent && (
                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-400'}`} />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Daily Details */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold flex items-center">
                        {format(selectedDate, 'M月d日 (E)', { locale: ja })} の予定
                    </h3>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                        {items.length}件のタスク
                    </span>
                </div>

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
                                        {item.time && (
                                            <span className="text-xs text-gray-400 font-mono mr-2">
                                                {item.time}
                                            </span>
                                        )}
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
            </div>

            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 flex items-start">
                <div className="mr-2 mt-0.5">💡</div>
                <div>
                    <strong>ヒント:</strong><br />
                    注文状況に基づいて、出荷に必要な野菜の量と、翌日以降に必要な準備量を自動算出しています。
                </div>
            </div>
        </div>
    );
}
