import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { invitationApi, authApi } from '../services/api';
import { liffService } from '../services/liff';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { Loader2 } from 'lucide-react';

export default function InviteHandler() {
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [inputCode, setInputCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lineUserId, setLineUserId] = useState<string | null>(null);

    const location = useLocation();
    const navigate = useNavigate();
    const setRestaurant = useStore(state => state.setRestaurant);
    const setStoreLineUserId = useStore(state => state.setLineUserId);

    useEffect(() => {
        // 1. Get token from URL (query param or path param)
        const params = new URLSearchParams(location.search);
        let token = params.get('token');

        // If not in query, check path (for legacy or alternative URL formats)
        if (!token && location.pathname.startsWith('/invite/')) {
            token = location.pathname.split('/')[2];
        }

        if (token) {
            setInviteToken(token);
            // Initialize LIFF to get user ID
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
            const profile = await liffService.getProfile();
            if (profile) {
                setLineUserId(profile.userId);
                setStoreLineUserId(profile.userId);
            }
        } catch (e) {
            console.error(e);
            // Fallback for dev
            if (process.env.NODE_ENV === 'development') {
                const mockId = 'mock-user-id-' + Math.random();
                setLineUserId(mockId);
                setStoreLineUserId(mockId);
            }
        }
    };

    const handleLink = async () => {
        if (!lineUserId || !inviteToken) return;

        setIsLoading(true);
        try {
            // 2. Call Link Account API
            const res = await invitationApi.linkAccount(lineUserId, inviteToken, inputCode);

            toast.success(`${res.data.name}様のアカウント連携が完了しました！`);

            // Redirect based on role
            if (res.data.role === 'farmer') {
                navigate(`/producer?farmer_id=${res.data.target_id || ''}`); // Backend should return ID, or fetch 'me'
            } else {
                // Refresh auth state
                const idToken = liffService.getIDToken();
                if (idToken) {
                    const authRes = await authApi.verify(idToken);
                    if (authRes.data.restaurant) {
                        setRestaurant(authRes.data.restaurant);
                    }
                }
                navigate('/');
            }
        } catch (error: any) {
            console.error("Invitation linking error detail:", error);
            if (error.response) {
                console.error("API Error Response:", error.response.data);
            }
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
                    disabled={isLoading || inputCode.length !== 4}
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
