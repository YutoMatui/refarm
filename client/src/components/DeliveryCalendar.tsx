import { useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DeliveryCalendarProps {
    selectedDate: string;
    onSelect: (date: string) => void;
    allowedDays: number[]; // 0=Sun, 1=Mon...
    closedDates?: string[]; // ["YYYY-MM-DD", ...]
    minDate: string; // YYYY-MM-DD
}

export default function DeliveryCalendar({ selectedDate, onSelect, allowedDays = [], closedDates = [], minDate }: DeliveryCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const startDate = startOfWeek(startOfMonth(currentMonth));
    const endDate = endOfWeek(endOfMonth(currentMonth));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    // Convert minDate string to Date object (start of day)
    const minDateObj = new Date(minDate + 'T00:00:00');

    const isDateSelectable = (date: Date) => {
        // Normalize date to start of day for comparison
        const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const minCheck = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate());

        // Check if before minDate
        if (checkDate < minCheck) return false;

        // Check closed dates
        const dateStr = format(date, 'yyyy-MM-dd');
        if (closedDates.includes(dateStr)) return false;

        // Check allowed days
        const dayOfWeek = getDay(date);
        return allowedDays.includes(dayOfWeek);
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
                <span className="font-bold text-gray-700">
                    {format(currentMonth, 'yyyy年 M月', { locale: ja })}
                </span>
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
                            onClick={() => isSelectable && onSelect(dateStr)}
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

                            {isSelectable ? (
                                <span className="text-xs text-green-600 font-bold">○</span>
                            ) : (
                                isCurrentMonth && (
                                    <span className="text-lg text-gray-300 absolute inset-0 flex items-center justify-center select-none font-light">
                                        /
                                    </span>
                                )
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
