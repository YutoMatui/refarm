import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, User, ThumbsUp, Send, X, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

// Mock Data
const FARMERS = [
    {
        id: 1,
        name: "田中 健一",
        main_crop: "有機トマト、ナス",
        image: "https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&q=80&w=800",
        bio: "神戸市西区で3代続く農家です。土作りにこだわり、農薬を使わずに育てた野菜は甘みが違います。",
        scenes: [
            "https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1628352081506-83c43123ed6d?auto=format&fit=crop&q=80&w=800"
        ]
    },
    {
        id: 2,
        name: "鈴木 さくら",
        main_crop: "レタス、ハーブ類",
        image: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&q=80&w=800",
        bio: "水耕栽培で、一年中安定して新鮮な葉物野菜をお届けしています。シャキシャキの食感をお楽しみください。",
        scenes: [
            "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&q=80&w=800"
        ]
    },
    {
        id: 3,
        name: "佐藤 浩",
        main_crop: "根菜類（大根、人参）",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800",
        bio: "冬の寒さにあたって甘みを増した根菜類が自慢です。煮物にするととろけるような柔らかさになります。",
        scenes: []
    }
];

export default function GuestLanding() {
    const [selectedFarmer, setSelectedFarmer] = useState<typeof FARMERS[0] | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [startTime] = useState(Date.now());

    // Analytics (Mock)
    useEffect(() => {
        return () => {
            const duration = (Date.now() - startTime) / 1000;
            console.log(`User stayed for ${duration} seconds`);
            // Here you would send this to your backend
        };
    }, [startTime]);

    const handleFarmerClick = (farmer: typeof FARMERS[0]) => {
        setSelectedFarmer(farmer);
    };

    const handleClose = () => {
        setSelectedFarmer(null);
        setShowForm(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simulate API call
        setTimeout(() => {
            setIsSuccess(true);
            toast.success('メッセージを送信しました！');
        }, 1000);
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6 text-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-6"
                >
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-4xl">
                        🎉
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h2>
                        <p className="text-gray-600">応援メッセージを<br />農家さんに届けます。</p>
                    </div>

                    <div className="pt-4">
                        <p className="text-xs text-gray-500 mb-3">旬の野菜情報やお得なクーポンを受け取る</p>
                        <a
                            href="https://line.me/R/ti/p/@placeholder"
                            target="_blank"
                            rel="noreferrer"
                            className="w-full bg-[#06C755] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95 transition-transform"
                        >
                            <MessageCircle className="fill-white" />
                            LINEで友だち追加
                        </a>
                    </div>

                    <button
                        onClick={() => setIsSuccess(false)}
                        className="text-gray-400 text-sm underline mt-4"
                    >
                        戻る
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 font-sans text-gray-800 pb-20">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-xs text-green-600 font-bold tracking-wider">TODAY'S PRODUCERS</p>
                        <h1 className="text-xl font-bold text-gray-900">本日の食材生産者</h1>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <User size={20} className="text-gray-400" />
                    </div>
                </div>
            </header>

            <main className="pt-6">
                <p className="px-6 text-sm text-gray-500 mb-4">
                    このお店の料理に使われている野菜を作った農家さんたちです。タップして詳細をご覧ください。
                </p>

                {/* Horizontal Carousel */}
                <div className="overflow-x-auto pb-8 hide-scrollbar snap-x snap-mandatory flex gap-4 px-6">
                    {FARMERS.map((farmer) => (
                        <motion.div
                            key={farmer.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleFarmerClick(farmer)}
                            className="snap-center shrink-0 w-[280px] bg-white rounded-2xl shadow-lg overflow-hidden relative group cursor-pointer"
                        >
                            <div className="aspect-[4/5] relative">
                                <img
                                    src={farmer.image}
                                    alt={farmer.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                                <div className="absolute bottom-0 left-0 p-5 text-white">
                                    <p className="text-xs font-medium opacity-90 mb-1">{farmer.main_crop}</p>
                                    <h3 className="text-2xl font-bold">{farmer.name}</h3>
                                    <div className="flex items-center gap-1 mt-2 text-xs opacity-80">
                                        <MapPin size={12} />
                                        <span>兵庫県神戸市</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </main>

            {/* Detail Modal / Drawer */}
            <AnimatePresence>
                {selectedFarmer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClose}
                            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-white z-50 rounded-t-3xl overflow-y-auto"
                        >
                            <div className="relative">
                                {/* Image Header */}
                                <div className="h-64 relative">
                                    <img
                                        src={selectedFarmer.image}
                                        alt={selectedFarmer.name}
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        onClick={handleClose}
                                        className="absolute top-4 right-4 bg-black/20 backdrop-blur-md p-2 rounded-full text-white"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="p-6 pb-32">
                                    <div className="mb-6">
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">
                                            {selectedFarmer.main_crop}
                                        </span>
                                        <h2 className="text-3xl font-bold mt-2 mb-1">{selectedFarmer.name}</h2>
                                        <div className="flex items-center text-gray-500 text-sm">
                                            <MapPin size={14} className="mr-1" /> 兵庫県神戸市西区
                                        </div>
                                    </div>

                                    <div className="prose prose-sm text-gray-600 mb-8">
                                        <h3 className="text-gray-900 font-bold mb-2">農家のこだわり</h3>
                                        <p className="leading-relaxed">{selectedFarmer.bio}</p>
                                    </div>

                                    {selectedFarmer.scenes.length > 0 && (
                                        <div className="mb-8">
                                            <h3 className="text-gray-900 font-bold mb-3">栽培風景</h3>
                                            <div className="flex gap-3 overflow-x-auto pb-2">
                                                {selectedFarmer.scenes.map((scene, i) => (
                                                    <img
                                                        key={i}
                                                        src={scene}
                                                        className="w-40 h-28 object-cover rounded-lg shrink-0"
                                                        alt="scene"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!showForm ? (
                                        <div className="space-y-3">
                                            <button
                                                onClick={() => setShowForm(true)}
                                                className="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                            >
                                                <Send size={18} />
                                                応援メッセージを送る
                                            </button>
                                            <button
                                                onClick={() => {
                                                    toast.success('「美味しかった！」を伝えました', { icon: '😋' });
                                                }}
                                                className="w-full bg-orange-50 text-orange-600 font-bold py-4 rounded-xl border border-orange-100 flex items-center justify-center gap-2 active:bg-orange-100 transition-colors"
                                            >
                                                <ThumbsUp size={18} />
                                                美味しかった！
                                            </button>
                                        </div>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-gray-50 p-6 rounded-2xl"
                                        >
                                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                                <MessageCircle size={18} className="text-green-600" />
                                                応援メッセージ
                                            </h3>
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">ニックネーム</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="ゲストさん"
                                                        className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">メッセージ</label>
                                                    <textarea
                                                        required
                                                        rows={3}
                                                        placeholder="ごちそうさまでした！とても美味しかったです。"
                                                        className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none"
                                                    />
                                                </div>
                                                <button
                                                    type="submit"
                                                    className="w-full bg-green-600 text-white font-bold py-3 rounded-xl shadow-md"
                                                >
                                                    送信する
                                                </button>
                                            </form>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
