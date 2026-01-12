import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { invitationApi, authApi } from '../services/api';
import { liffService } from '../services/liff';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { Loader2, AlertCircle } from 'lucide-react';

export default function InviteHandler() {
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [inputCode, setInputCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [initializationError, setInitializationError] = useState<string | null>(null);
    const [lineUserId, setLineUserId] = useState<string | null>(null);

    const location = useLocation();
    const navigate = useNavigate();
    const setRestaurant = useStore(state => state.setRestaurant);
    const setStoreLineUserId = useStore(state => state.setLineUserId);

    useEffect(() => {
        const processInvitation = async (token: string) => {
            try {
                // First, determine the role from the invite token
                const { data } = await invitationApi.getInvitationInfo(token);
                const role = data.role;

                // Now, initialize LIFF with the correct context
                const isReady = await initializeLiff(role);

                // Only stop initializing if we are not redirecting to login
                if (isReady) {
                    setIsInitializing(false);
                }

            } catch (error: any) {
                console.error("Failed to process invitation:", error);
                setInitializationError(error.response?.data?.detail || "招待URLが無効か、期限切れです。");
                setIsInitializing(false);
            }
        };

        const params = new URLSearchParams(location.search);
        let token = params.get('token');

        if (!token && location.pathname.startsWith('/invite/')) {
            token = location.pathname.split('/')[2];
        }

        if (token) {
            setInviteToken(token);
            localStorage.removeItem('admin_token');
            processInvitation(token);
        } else {
            setIsInitializing(false); // No token found, stop initializing
        }
    }, [location]);

    const initializeLiff = async (role: string): Promise<boolean> => {
        try {
            await liffService.init({ role });
            if (!liffService.isLoggedIn()) {
                liffService.login();
                return false; // Stop execution to allow LIFF to handle login redirect
            }
            const profile = await liffService.getProfile();
            if (profile) {
                setLineUserId(profile.userId);
                setStoreLineUserId(profile.userId);
            } else {
                // This can happen if user revokes permissions
                throw new Error("LINEプロフィールを取得できませんでした。");
            }
            return true;
        } catch (e: any) {
            console.error("LIFF Initialization failed:", e);
            // Fallback for dev, but show error in production
            if (process.env.NODE_ENV === 'development') {
                const mockId = 'mock-user-id-' + Math.random();
                setLineUserId(mockId);
                setStoreLineUserId(mockId);
                toast.warning("開発モード: LIFF初期化に失敗。モックIDを使用します。");
            } else {
                setInitializationError("LINEの認証に失敗しました。画面を再読み込みしてください。");
            }
            return true;
        }
    };

    const handleLink = async () => {
        if (!lineUserId || !inviteToken) return;

        setIsLoading(true);
        try {
            const res = await invitationApi.linkAccount(lineUserId, inviteToken, inputCode);

            toast.success(`${res.data.name}様のアカウント連携が完了しました！`);

            setTimeout(async () => {
                if (res.data.role === 'farmer') {
                    // Force refresh to ensure clean state and correct context for producer app
                    window.location.href = `/producer?farmer_id=${res.data.target_id || ''}`;
                } else {
                    // For restaurants, we need to refresh auth state before redirecting
                    try {
                        const idToken = liffService.getIDToken();
                        if (idToken) {
                            const authRes = await authApi.verify(idToken);
                            if (authRes.data.restaurant) {
                                setRestaurant(authRes.data.restaurant);
                            }
                        }
                    } catch (e) {
                        console.error("Failed to refresh auth state", e);
                    }
                    // For restaurant, refresh page to ensure clean state and correct routing
                    window.location.href = '/products';
                }
            }, 1000);

        } catch (error: any) {
            console.error("Invitation linking error detail:", error);
            toast.error(error.response?.data?.detail || "コードが間違っているか、URLの有効期限が切れています。");
        } finally {
            setIsLoading(false);
        }
    };

    // This component should only be active if a token is present
    if (!inviteToken && !isInitializing) return null;

    // Loading state while fetching role and initializing LIFF
    if (isInitializing) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-6">
                <Loader2 className="animate-spin text-green-600 h-12 w-12" />
                <p className="mt-4 text-gray-600">招待情報を確認中...</p>
            </div>
        );
    }

    // Error state if invitation is invalid
    if (initializationError) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="text-red-500 h-12 w-12" />
                <h2 className="mt-4 text-xl font-bold text-gray-800">エラー</h2>
                <p className="mt-2 text-gray-600">{initializationError}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 bg-green-600 text-white font-bold py-2 px-6 rounded-lg text-md shadow-md"
                >
                    再試行
                </button>
            </div>
        );
    }

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
                    disabled={isLoading || inputCode.length !== 4 || !lineUserId}
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
