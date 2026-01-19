import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, User, Send, X, Heart, Star, Sprout, ThumbsUp, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { guestApi } from '@/services/api';
import { useAnalytics } from '@/hooks/useAnalytics';

// Types
type Farmer = {
    id: number;
    name: string;
    main_crop?: string;
    image?: string;
    bio?: string;
    scenes: string[];
};

type Restaurant = {
    id: number;
    name: string;
    message: string | null;
};

// Stamps Definition
const STAMPS = [
    { id: 'delicious', label: '美味しかった', icon: <ThumbsUp size={24} />, color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'cheer', label: '応援してます', icon: <Heart size={24} />, color: 'text-pink-500', bg: 'bg-pink-50' },
    { id: 'nice', label: 'こだわり素敵', icon: <Star size={24} />, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { id: 'eat_again', label: 'また食べたい', icon: <Sprout size={24} />, color: 'text-green-600', bg: 'bg-green-50' },
];

export default function GuestLanding() {
    const [searchParams] = useSearchParams();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [visitId, setVisitId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    // showForm state removed to make form always visible
    const [isSuccess, setIsSuccess] = useState(false);

    // Analytics
    const { visitorId } = useAnalytics();

    // Analytics refs
    const scrollDepthRef = useRef(0);
    const carouselRef = useRef<HTMLDivElement>(null);
    const observedFarmersRef = useRef<Set<number>>(new Set());

    // Random Thank You Content
    const [thankYouContent, setThankYouContent] = useState<any>(null);

    // Initial Data Load
    useEffect(() => {
        const init = async () => {
            try {
                const storeIdParam = searchParams.get('store'); // e.g., ?store=1
                const storeId = storeIdParam ? parseInt(storeIdParam) : 1; // Default to 1 for demo

                // 1. Visit Log
                if (visitorId) {
                    const visitRes = await guestApi.visit(storeId, visitorId);
                    setVisitId(visitRes.data.visit_id);
                }

                // 2. Fetch Restaurant
                const restRes = await guestApi.getRestaurant(storeId);
                setRestaurant(restRes.data);

                // 3. Fetch Farmers
                const farmersRes = await guestApi.getFarmers();
                setFarmers(farmersRes.data);

            } catch (err) {
                console.error("Failed to load guest data", err);
                toast.error("データの読み込みに失敗しました");
            } finally {
                setLoading(false);
            }
        };
        if (visitorId) {
            init();
        }
    }, [searchParams, visitorId]);

    // Analytics: Scroll & Stay Time
    useEffect(() => {
        const handleScroll = () => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            if (scrolled > scrollDepthRef.current) {
                scrollDepthRef.current = Math.round(scrolled);
            }
        };

        const activeTimeRef = {
            totalSeconds: 0,
            lastStartTime: Date.now(),
            isPaused: false
        };

        const updateActiveTime = () => {
            if (!activeTimeRef.isPaused) {
                const now = Date.now();
                activeTimeRef.totalSeconds += Math.round((now - activeTimeRef.lastStartTime) / 1000);
                activeTimeRef.lastStartTime = now;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                updateActiveTime();
                activeTimeRef.isPaused = true;
            } else {
                activeTimeRef.lastStartTime = Date.now();
                activeTimeRef.isPaused = false;
            }
        };

        window.addEventListener('scroll', handleScroll);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Periodic log update (every 10 seconds)
        const intervalId = setInterval(() => {
            if (visitId) {
                updateActiveTime();
                guestApi.log({
                    visit_id: visitId,
                    stay_time: activeTimeRef.totalSeconds,
                    scroll_depth: scrollDepthRef.current
                }).catch(console.error);
            }
        }, 10000);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(intervalId);

            // Send final log on unmount
            if (visitId) {
                updateActiveTime();
                const data = JSON.stringify({
                    visit_id: visitId,
                    stay_time: activeTimeRef.totalSeconds,
                    scroll_depth: scrollDepthRef.current
                });

                const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
                navigator.sendBeacon(`${apiUrl}/guest/log`, new Blob([data], { type: 'application/json' }));
            }
        };
    }, [visitId]);

    // Carousel Auto Scroll & Interest Log
    useEffect(() => {
        if (!carouselRef.current || farmers.length === 0) return;

        // Auto Scroll
        const interval = setInterval(() => {
            if (carouselRef.current && !selectedFarmer) {
                const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
                if (scrollLeft + clientWidth >= scrollWidth - 10) {
                    carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                }
            }
        }, 5000); // 5 seconds auto scroll

        return () => clearInterval(interval);
    }, [farmers, selectedFarmer]);

    // Handle farmer card click for INTEREST tracking
    const handleFarmerClick = async (farmer: Farmer) => {
        setSelectedFarmer(farmer);

        // Log INTEREST only when user actually clicks on the card
        if (visitId && !observedFarmersRef.current.has(farmer.id)) {
            try {
                await guestApi.interaction({
                    visit_id: visitId,
                    farmer_id: farmer.id,
                    interaction_type: 'INTEREST'
                });
                observedFarmersRef.current.add(farmer.id);
            } catch (error) {
                console.error('Failed to log interest:', error);
            }
        }
    };


    const handleStamp = async (stampId: string) => {
        if (!visitId || !selectedFarmer) return;
        try {
            await guestApi.interaction({
                visit_id: visitId,
                farmer_id: selectedFarmer.id,
                interaction_type: 'STAMP',
                stamp_type: stampId
            });
            toast.success('スタンプを送りました！', { duration: 2000 });
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visitId) return;

        const form = e.target as HTMLFormElement;
        const nickname = (form.elements.namedItem('nickname') as HTMLInputElement).value || '匿名のお客様';
        const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value;

        try {
            await guestApi.interaction({
                visit_id: visitId,
                farmer_id: null as any, // Allow null for general messages
                interaction_type: 'MESSAGE',
                comment: message,
                nickname: nickname
            });

            // Randomize Thank You Content
            const patterns = [
                {
                    type: 'A',
                    title: '応援ありがとうございます！',
                    msg: '生産者さんにあなたの声を届けます。',
                    image: selectedFarmer ? selectedFarmer.image : 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80' // Farmer or Generic Smile
                },
                {
                    type: 'B',
                    title: '励みになります！',
                    msg: 'これからも美味しい野菜を作り続けます。',
                    image: 'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?auto=format&fit=crop&q=80' // Veggies
                },
                {
                    type: 'C',
                    title: 'また食べてね！',
                    msg: 'ベジコベは神戸の農業を応援しています。',
                    image: '/logo.png' // Character/Logo (Placeholder)
                }
            ];
            setThankYouContent(patterns[Math.floor(Math.random() * patterns.length)]);

            setIsSuccess(true);
        } catch (e) {
            toast.error('送信に失敗しました');
        }
    };

    if (isSuccess && thankYouContent) {
        return (
            <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center font-serif">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-6"
                >
                    <div className="w-32 h-32 rounded-full overflow-hidden mx-auto border-4 border-green-50">
                        <img src={thankYouContent.image || '/placeholder.png'} alt="Thanks" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-stone-800 mb-2">{thankYouContent.title}</h2>
                        <p className="text-stone-600">{thankYouContent.msg}</p>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <button
                            onClick={() => {
                                setIsSuccess(false);
                                setThankYouContent(null);
                            }}
                            className="text-stone-500 text-sm underline hover:text-green-700"
                        >
                            戻る
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="mb-4"
                >
                    <Sprout className="text-green-700 w-12 h-12" />
                </motion.div>
                <p className="text-stone-500 font-serif text-sm tracking-widest">Loading...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 font-serif text-stone-800 pb-20 selection:bg-green-100">
            {/* Header / Intro */}
            <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-10 px-6 py-5 shadow-sm border-b border-stone-100">
                <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] text-green-800 font-bold tracking-[0.2em] uppercase">Kobe Nishi Farmers</p>
                    <div className="w-8 h-8 bg-stone-50 rounded-full flex items-center justify-center border border-stone-100">
                        <User size={14} className="text-stone-400" />
                    </div>
                </div>
                {restaurant && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2"
                    >
                        <h1 className="text-lg font-bold text-stone-900 border-l-[3px] border-green-700 pl-3 mb-2 leading-none">
                            {restaurant.name}
                        </h1>
                        <p className="text-sm text-stone-600 leading-relaxed pl-3 font-medium opacity-90">
                            {restaurant.message || "当店は西区の新鮮野菜を使用しています。"}
                        </p>
                    </motion.div>
                )}
            </header>

            <main className="pt-10">
                <div className="px-8 text-center mb-8">
                    <h2 className="text-xl font-bold text-stone-800 mb-3 tracking-wide">生産者の顔が見える<br />安心で美味しい野菜</h2>
                    <p className="text-xs text-stone-500 leading-7">
                        このお店で使われている食材の<br />
                        生産者さんをご紹介します。
                    </p>
                </div>

                {/* Farmers Carousel */}
                <div
                    ref={carouselRef}
                    className="overflow-x-auto pb-12 hide-scrollbar snap-x snap-mandatory flex gap-5 px-8"
                >
                    {farmers.map((farmer) => (
                        <motion.div
                            key={farmer.id}
                            data-id={farmer.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleFarmerClick(farmer)}
                            className="farmer-card snap-center shrink-0 w-[280px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative group cursor-pointer border border-stone-100"
                        >
                            <div className="aspect-[3/4] relative">
                                <img
                                    src={farmer.image || 'https://placehold.co/600x400/e2e8f0/1e293b?text=No+Image'}
                                    alt={farmer.name}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 p-6 text-white w-full">
                                    <span className="inline-block bg-white/20 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold tracking-wider mb-2 border border-white/30">
                                        {farmer.main_crop}
                                    </span>
                                    <h3 className="text-2xl font-bold mb-2 font-serif">{farmer.name}</h3>
                                    <p className="text-xs opacity-90 line-clamp-2 leading-relaxed font-sans font-light">
                                        {farmer.bio}
                                    </p>
                                    <div className="flex items-center gap-1 mt-4 text-[10px] font-bold tracking-widest opacity-80 justify-end">
                                        <span>VIEW MORE</span>
                                        <ChevronRight size={12} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* General Message Form */}
                <div className="px-6 py-10 bg-white mt-8 border-t border-stone-100">
                    <div className="max-w-md mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-stone-800 mb-2">応援メッセージ</h3>
                            <p className="text-sm text-stone-600 font-medium">
                                農家さんの励みになりますので<br />応援コメントよろしくお願いします。
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 bg-stone-50 p-6 rounded-2xl">
                            <div>
                                <label className="block text-xs font-bold text-stone-500 mb-1">ニックネーム</label>
                                <input
                                    name="nickname"
                                    type="text"
                                    placeholder="匿名のお客様"
                                    className="w-full p-3 rounded-lg border border-stone-200 focus:ring-1 focus:ring-green-500 outline-none bg-white text-base"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-stone-500 mb-1">メッセージ</label>
                                <textarea
                                    name="message"
                                    rows={3}
                                    placeholder="美味しかった！応援しています。"
                                    className="w-full p-3 rounded-lg border border-stone-200 focus:ring-1 focus:ring-green-500 outline-none bg-white text-base"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-green-700 text-white font-bold py-3 rounded-xl shadow-md hover:bg-green-800 transition-colors flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Send size={18} />
                                送信する
                            </button>
                        </form>
                    </div>
                </div>
            </main>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedFarmer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedFarmer(null)}
                            className="fixed inset-0 bg-stone-900/60 z-40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 h-[90dvh] bg-white z-50 rounded-t-3xl overflow-y-auto"
                        >
                            <div className="relative pb-20">
                                {/* Header Image */}
                                <div className="h-72 relative">
                                    <img
                                        src={selectedFarmer.image || 'https://placehold.co/600x400/e2e8f0/1e293b?text=No+Image'}
                                        alt={selectedFarmer.name}
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        onClick={() => {
                                            setSelectedFarmer(null);
                                        }}
                                        className="absolute top-4 right-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/50 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="p-8 -mt-6 bg-white rounded-t-3xl relative">
                                    <div className="mb-8">
                                        <span className="bg-green-700 text-white text-[10px] px-3 py-1 rounded-full tracking-wider mb-2 inline-block">
                                            KOBE NISHI
                                        </span>
                                        <h2 className="text-2xl font-bold text-stone-800 mt-1 mb-2">{selectedFarmer.name}</h2>
                                        <div className="flex items-center text-stone-500 text-sm">
                                            <MapPin size={14} className="mr-1" /> 兵庫県神戸市西区
                                        </div>
                                    </div>

                                    <div className="prose prose-stone text-stone-600 mb-10 leading-loose">
                                        <h3 className="text-stone-900 font-bold mb-3 border-b border-stone-100 pb-2">生産者のこだわり</h3>
                                        <p>{selectedFarmer.bio}</p>
                                    </div>

                                    {/* Action Area */}
                                    <div className="bg-stone-50 rounded-2xl p-6 mb-8">
                                        <h3 className="text-stone-800 font-bold mb-4 text-center">応援メッセージを送る</h3>

                                        {/* Stamps */}
                                        <div className="grid grid-cols-2 gap-3 mb-6">
                                            {STAMPS.map((stamp) => (
                                                <button
                                                    key={stamp.id}
                                                    onClick={() => handleStamp(stamp.id)}
                                                    className={`${stamp.bg} ${stamp.color} py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 border border-transparent hover:border-current`}
                                                >
                                                    {stamp.icon}
                                                    <span className="text-xs font-bold">{stamp.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
