import { useState, useMemo } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { deliveryScheduleApi, farmerApi } from '@/services/api';
import { DeliverySchedule, CartItem } from '@/types';

interface DeliveryCalendarProps {
    selectedDate: string;
    onSelect: (date: string, schedule?: DeliverySchedule) => void;
    minDate: string; // YYYY-MM-DD
    cart?: CartItem[]; // New prop
}

export default function DeliveryCalendar({ selectedDate, onSelect, minDate, cart = [] }: DeliveryCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const startDate = startOfWeek(startOfMonth(currentMonth));
    const endDate = endOfWeek(endOfMonth(currentMonth));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    // Convert minDate string to Date object (start of day)
    const minDateObj = new Date(minDate + 'T00:00:00');

    // Fetch schedules for the current month
    const monthStr = format(currentMonth, 'yyyy-MM')
    const { data: schedules } = useQuery<DeliverySchedule[]>({
        queryKey: ['delivery-schedules', monthStr],
        queryFn: async () => {
            const res = await deliveryScheduleApi.list(monthStr)
            return res.data
        }
    })

    // --- Bulk Farmer Availability ---
    const uniqueFarmerIds = useMemo(() => {
        return Array.from(new Set(
            cart
                .map(item => item.product.farmer_id)
                .filter(id => id !== undefined && id !== null && id !== 0)
        )) as number[];
    }, [cart]);

    const { data: bulkAvailability } = useQuery({
        queryKey: ['farmer-availability-bulk', monthStr, uniqueFarmerIds],
        queryFn: async () => {
            if (uniqueFarmerIds.length === 0) return null;
            const res = await farmerApi.checkAvailabilityBulk({
                farmer_ids: uniqueFarmerIds,
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(endDate, 'yyyy-MM-dd')
            });
            return res.data;
        },
        enabled: uniqueFarmerIds.length > 0
    });
    // --------------------------------

    const getSchedule = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return schedules?.find(s => s.date === dateStr);
    };

    const isDateSelectable = (date: Date) => {
        // Normalize date to start of day for comparison
        const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const minCheck = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate());

        // Check if before minDate
        if (checkDate < minCheck) return false;

        const schedule = getSchedule(date);

        // If schedule exists, strictly follow is_available
        if (schedule) {
            return schedule.is_available;
        }

        return false;
    };

    const getAvailabilityIcon = (date: Date, isSelectable: boolean) => {
        if (!isSelectable) return <span className="text-lg text-gray-300 absolute inset-0 flex items-center justify-center select-none font-light">/</span>;

        const dateStr = format(date, 'yyyy-MM-dd');
        const avail = bulkAvailability?.[dateStr];

        if (!avail || uniqueFarmerIds.length === 0) {
            return <span className="text-xs text-green-600 font-bold">○</span>;
        }

        if (avail.all_available) {
            return <span className="text-xs text-green-600 font-bold">○</span>;
        } else if (avail.available.length > 0) {
            return (
                <div className="flex flex-col items-center">
                    <span className="text-xs text-orange-500 font-bold">△</span>
                    <span className="text-[8px] text-orange-400 scale-90">一部不可</span>
                </div>
            );
        } else {
            return <span className="text-xs text-red-500 font-bold">×</span>;
        }
    };

    const handlePrevMonth = () => setCurrentMonth(prev => addMonths(prev, -1));
    const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden select-none">
            <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                <button
                    onClick={handlePrevMonth}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    type="button"
                >
                    <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-gray-700">
                        {format(currentMonth, 'yyyy年 M月', { locale: ja })}
                    </span>
                    {uniqueFarmerIds.length > 0 && (
                        <span className="text-[10px] text-gray-400 font-medium">カート商品の出荷状況を表示中</span>
                    )}
                </div>
                <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    type="button"
                >
                    <ChevronRight size={20} className="text-gray-600" />
                </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-medium bg-gray-50 border-b border-gray-200">
                {weekDays.map((d, i) => (
                    <div key={i} className={`py-2 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 border-l border-t border-gray-200">
                {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isSelectable = isDateSelectable(day);
                    const isSelected = selectedDate === dateStr;
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    // Border styling to create grid
                    const borderClasses = "border-r border-b border-gray-200";

                    return (
                        <button
                            key={dateStr}
                            onClick={() => {
                                if (isSelectable) {
                                    const schedule = getSchedule(day);
                                    onSelect(dateStr, schedule);
                                }
                            }}
                            disabled={!isSelectable}
                            type="button"
                            className={`
                                ${borderClasses}
                                relative h-16 flex flex-col items-center justify-center
                                ${!isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'}
                                ${isSelected ? 'bg-green-50 ring-2 ring-inset ring-green-500 z-10' : ''}
                                ${!isSelectable && isCurrentMonth ? 'bg-gray-50' : ''}
                                ${isSelectable ? 'hover:bg-green-50/50 cursor-pointer active:bg-green-100' : 'cursor-not-allowed opacity-60'}
                                transition-colors
                            `}
                        >
                            <span className={`
                                text-sm mb-1 font-medium
                                ${isSelected ? 'text-green-700' : ''}
                                ${!isSelectable ? 'text-gray-400' : 'text-gray-700'}
                                ${getDay(day) === 0 && isSelectable ? 'text-red-600' : ''}
                                ${getDay(day) === 6 && isSelectable ? 'text-blue-600' : ''}
                            `}>
                                {format(day, 'd')}
                            </span>

                            {getAvailabilityIcon(day, isSelectable)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
