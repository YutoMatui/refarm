import React from 'react';
import { ShoppingBasket, Truck, X, Trash2 } from 'lucide-react';

interface AvailabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    unavailableItems: {
        productName: string;
        farmerName: string;
        reason: string;
        productId: number;
        farmerId: number;
    }[];
    nextAvailableDate?: {
        date: string;
        label: string;
    };
    onConsolidate: (date: string) => void; // A: Ship everything together on next date
    onRemoveUnavailable: () => void;      // B: Remove unavailable items and proceed
}

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({
    isOpen,
    onClose,
    unavailableItems,
    nextAvailableDate,
    onConsolidate,
    onRemoveUnavailable,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-orange-50 px-6 py-4 flex items-center justify-between border-b border-orange-100">
                    <div className="flex items-center gap-3 text-orange-700">
                        <ShoppingBasket size={24} />
                        <h2 className="text-lg font-bold">注文内容の確認が必要です</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <p className="text-gray-700 font-medium leading-relaxed">
                            ご指定の日付にお届けできない商品が含まれています。
                        </p>

                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                            {unavailableItems.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-sm">
                                    <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-orange-400" />
                                    <div>
                                        <p className="font-bold text-gray-900">{item.productName}</p>
                                        <p className="text-gray-500 text-xs">農家: {item.farmerName} / 理由: {item.reason}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">解決方法を選択してください</p>

                        {/* Option A: Consolidate */}
                        {nextAvailableDate && (
                            <button
                                onClick={() => onConsolidate(nextAvailableDate.date)}
                                className="w-full group rounded-xl border-2 border-emerald-100 bg-emerald-50 p-4 text-left hover:border-emerald-500 hover:shadow-md transition-all space-y-1"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-emerald-700 font-bold">
                                        <Truck size={18} />
                                        <span>A. まとめて受け取る</span>
                                    </div>
                                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">送料節約</span>
                                </div>
                                <p className="text-sm text-gray-900 font-bold ml-6">
                                    {nextAvailableDate.label} にすべてお届け可能です。
                                </p>
                                <p className="text-[11px] text-emerald-600 ml-6">（すべての商品が揃う最短日です）</p>
                            </button>
                        )}

                        {/* Option B: Remove and Continue */}
                        <button
                            onClick={onRemoveUnavailable}
                            className="w-full group rounded-xl border-2 border-gray-100 bg-gray-50 p-4 text-left hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-sm transition-all space-y-1"
                        >
                            <div className="flex items-center gap-2 text-gray-600 font-bold group-hover:text-orange-700">
                                <Trash2 size={18} />
                                <span>B. 該当商品を削除して進む</span>
                            </div>
                            <p className="text-sm text-gray-600 ml-6 group-hover:text-gray-900">
                                お届け不可の商品のみを削除し、指定の日付で注文を続けます。
                            </p>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                    >
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvailabilityModal;
