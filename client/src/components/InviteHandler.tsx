import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { liffService } from '../services/liff';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { Loader2 } from 'lucide-react';

export default function InviteHandler() {
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [inputCode, setInputCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [idToken, setIdToken] = useState<string | null>(null);

    const location = useLocation();
    const navigate = useNavigate();
    const { setRestaurant, setFarmer, setUserRole, setLineUserId: setStoreLineUserId } = useStore();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        let token = params.get('token');

        if (!token && location.pathname.startsWith('/invite/')) {
            token = location.pathname.split('/')[2];
        }

        if (token) {
            setInviteToken(token);
            initializeLiff();
        }
    }, [location]);

    const initializeLiff = async () => {
        try {
            await liffService.init();
            if (!liffService.isLoggedIn()) {
                liffService.login();
                return;
            }
            const token = liffService.getIDToken();
            if (!token) {
                toast.error("LINEからユーザー情報を取得できませんでした。");
                // Potentially trigger login again or show error state
                return;
            }
            setIdToken(token);

            const profile = await liffService.getProfile();
            if (profile) {
                setLineUserId(profile.userId);
                setStoreLineUserId(profile.userId);
            }
        } catch (e) {
            console.error(e);
            toast.error("LIFFの初期化に失敗しました。");
            // Fallback for dev
            if (process.env.NODE_ENV === 'development') {
                const mockId = 'mock-user-id-' + Math.random();
                setLineUserId(mockId);
                setStoreLineUserId(mockId);
                setIdToken('mock-id-token-invite');
            }
        }
    };

    const handleLink = async () => {
        if (!idToken || !inviteToken) {
            toast.error("認証情報が不足しています。ページを再読み込みしてください。");
            return;
        }

        setIsLoading(true);
        try {
            // Call the unified verify endpoint with invite details
            const res = await authApi.verify(idToken, inviteToken, inputCode);
            const { role, farmer, restaurant, message, is_registered } = res.data;

            if (!is_registered) {
                // This case should ideally not happen if linking was successful
                throw new Error("アカウント連携に失敗しました。");
            }
            
            // Update global store
            setStoreLineUserId(res.data.line_user_id);
            setUserRole(role as any);
            if (role === 'farmer' && farmer) setFarmer(farmer);
            if (role === 'restaurant' && restaurant) setRestaurant(restaurant);

            toast.success(message || "アカウント連携が完了しました！");

            setTimeout(() => {
                if (role === 'farmer') {
                    window.location.href = `/producer`;
                } else {
                    navigate('/');
                }
            }, 1000);

        } catch (error: any) {
            console.error("Invitation linking error detail:", error);
            toast.error(error.response?.data?.detail || "コードが間違っているか、URLの有効期限が切れています。");
        } finally {
            setIsLoading(false);
        }
    };

    if (!inviteToken) return null;

    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-6">
            <div className="max-w-sm w-full space-y-8 text-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">初回アカウント連携</h2>
                    <p className="text-gray-600">
                        管理者から受け取った4桁の認証コードを入力してください。
                    </p>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border border-green-100">
                    <input
                        type="text"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                        className="w-full border-2 border-green-200 rounded-lg p-4 text-center text-4xl font-mono tracking-[1em] focus:border-green-500 focus:outline-none"
                        placeholder="0000"
                        inputMode="numeric"
                        autoFocus
                    />
                </div>

                <button
                    onClick={handleLink}
                    disabled={isLoading || inputCode.length !== 4 || !idToken}
                    className="w-full bg-green-600 text-white font-bold py-4 rounded-xl text-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                    連携して始める
                </button>

                <p className="text-xs text-gray-400 mt-8">
                    LINEアカウント: {lineUserId ? '確認済み' : '確認中...'}
                </p>
            </div>
        </div>
    );
}
