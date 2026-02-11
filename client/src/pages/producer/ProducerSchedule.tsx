import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, Truck, Calendar as CalendarIcon, Loader2, CheckCircle2, Settings } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { producerApi } from '../../services/api';
import { FarmerSchedule } from '@/types';

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
    useOutletContext<{ farmerId: number; }>();
    const [currentDate, setCurrentDate] = useState(new Date()); // Represents the currently displayed month
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Availability Settings
    const [scheduleSettings, setScheduleSettings] = useState<FarmerSchedule[]>([]);
    const [selectableDays, setSelectableDays] = useState<number[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showWeeklySettings, setShowWeeklySettings] = useState(false);

    // Fetch Farmer Profile
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await producerApi.getProfile();
                if (res.data.selectable_days) {
                    try {
                        const days = JSON.parse(res.data.selectable_days);
                        setSelectableDays(Array.isArray(days) ? days : [3]); // Default to Wed if array issue
                    } catch (e) {
                        console.error("Failed to parse selectable_days", e);
                        setSelectableDays([3]); // Default to Wednesday
                    }
                } else {
                    setSelectableDays([3]); // Default to Wednesday if null
                }
            } catch (e) {
                console.error("Failed to fetch profile", e);
            }
        };
        fetchProfile();
    }, []);

    // Fetch monthly data
    useEffect(() => {
        const fetchMonthly = async () => {
            try {
                // Removed getSales call (orange dots removed) for performance

                // Fetch Schedule Settings
                const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
                const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
                const settingsRes = await producerApi.getScheduleSettings(start, end);
                setScheduleSettings(settingsRes.data);

            } catch (e) {
                console.error("Failed to fetch monthly data:", e);
            }
        };
        fetchMonthly();
    }, [currentDate]);

    // Fetch daily tasks when selectedDate changes
    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const response = await producerApi.getSchedule(undefined, dateStr);
                setItems(response.data);
            } catch (error) {
                console.error("Failed to fetch schedule:", error);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [selectedDate]);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Generate days for the full month view
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = monthStart.getDay();
    const emptyStartDays = Array.from({ length: startDayOfWeek });

    // Check Availability Logic
    const isDateAvailable = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        // Check specific override
        const setting = scheduleSettings.find(s => s.date === dateStr);
        if (setting) return setting.is_available;

        // Check weekly schedule
        const dayOfWeek = getDay(date);
        return selectableDays.includes(dayOfWeek);
    };

    const toggleDateAvailability = async (date: Date, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the date when clicking the toggle
        if (isUpdating) return;
        setIsUpdating(true);

        const currentStatus = isDateAvailable(date);
        const newStatus = !currentStatus;
        const dateStr = format(date, 'yyyy-MM-dd');

        try {
            const res = await producerApi.updateScheduleSetting(dateStr, newStatus);

            // Update local state
            setScheduleSettings(prev => {
                const idx = prev.findIndex(s => s.date === dateStr);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = res.data;
                    return updated;
                } else {
                    return [...prev, res.data];
                }
            });
        } catch (error) {
            console.error("Failed to update availability", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const toggleWeeklyDay = async (dayIndex: number) => {
        if (isUpdating) return;
        setIsUpdating(true);

        const newDays = selectableDays.includes(dayIndex)
            ? selectableDays.filter(d => d !== dayIndex)
            : [...selectableDays, dayIndex].sort();

        try {
            await producerApi.updateProfile(undefined, {
                selectable_days: JSON.stringify(newDays)
            });
            setSelectableDays(newDays);
        } catch (error) {
            console.error("Failed to update weekly schedule", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center whitespace-nowrap">
                    <CalendarIcon className="mr-2" />
                    出荷・準備<br className="md:hidden" />スケジュール
                </h2>
                <button
                    onClick={() => setShowWeeklySettings(!showWeeklySettings)}
                    className="flex items-center text-sm bg-white border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium shadow-sm transition-colors whitespace-nowrap"
                >
                    <Settings size={16} className="mr-2" />
                    {showWeeklySettings ? (
                        <>カレンダーに<br className="md:hidden" />戻る</>
                    ) : '曜日設定'}
                </button>
            </div>

            {showWeeklySettings ? (
                <div className="bg-white rounded-xl shadow p-6">
                    <h3 className="font-bold text-lg mb-4">毎週の出荷可能日設定</h3>
                    <p className="text-gray-500 text-sm mb-6">
                        定期的に出荷を受け付ける曜日を選択してください。<br />
                        初期設定では水曜日が受け入れ可能になっています。
                    </p>
                    <div className="flex flex-wrap gap-4">
                        {weekDays.map((day, i) => {
                            const isSelected = selectableDays.includes(i);
                            return (
                                <button
                                    key={day}
                                    onClick={() => toggleWeeklyDay(i)}
                                    disabled={isUpdating}
                                    className={`
                                        w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 transition-all
                                        ${isSelected
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                                        }
                                    `}
                                >
                                    <span className="font-bold text-lg">{day}</span>
                                    {isSelected && <CheckCircle2 size={16} className="text-green-500 mt-1" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <>
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
                            {weekDays.map((d, i) => (
                                <div key={d} className={`text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 auto-rows-fr">
                            {emptyStartDays.map((_, i) => <div key={`empty-${i}`} />)}

                            {daysInMonth.map((day) => {
                                const isSelected = isSameDay(day, selectedDate);
                                const available = isDateAvailable(day);

                                return (
                                    <div
                                        key={day.toString()}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                                            flex flex-col items-center p-1 rounded-lg transition-colors relative h-20 cursor-pointer border
                                            ${isSelected
                                                ? 'border-green-500 ring-1 ring-green-500 z-10'
                                                : available
                                                    ? 'bg-green-50/30 border-transparent hover:bg-green-50'
                                                    : 'bg-white border-transparent hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between w-full items-start">
                                            <span className={`text-sm ml-1 ${isSelected ? 'font-bold text-green-700' : 'text-gray-700'}`}>
                                                {format(day, 'd')}
                                            </span>
                                            <button
                                                onClick={(e) => toggleDateAvailability(day, e)}
                                                className={`mr-1 mt-1 p-0.5 rounded-full hover:bg-gray-200 transition-colors`}
                                                title={available ? "受付可" : "受付不可"}
                                            >
                                                {available
                                                    ? <span className="text-green-500 text-xs font-bold border border-green-500 rounded-full w-5 h-5 flex items-center justify-center bg-white">○</span>
                                                    : <span className="text-gray-300 text-xs font-bold border border-gray-300 rounded-full w-5 h-5 flex items-center justify-center bg-gray-50">×</span>
                                                }
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Daily Details */}
                    <div className="bg-white rounded-xl shadow overflow-hidden min-h-[300px]">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold flex items-center">
                                    {format(selectedDate, 'M月d日 (E)', { locale: ja })} の予定
                                </h3>
                                <div className="mt-1">
                                    {isDateAvailable(selectedDate)
                                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">出荷受付中</span>
                                        : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">出荷受付停止</span>
                                    }
                                </div>
                            </div>
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
                                    items.map((item: ScheduleItem) => (
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
                </>
            )}
        </div>
    );
}
