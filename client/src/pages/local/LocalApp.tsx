import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { liffService } from '@/services/liff'
import { consumerApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import LocalHome from '@/pages/local/LocalHome'
import LocalSearch from '@/pages/local/LocalSearch'
import LocalFarmers from '@/pages/local/LocalFarmers'
import LocalFarmerDetail from '@/pages/local/LocalFarmerDetail'
import LocalMyPage from '@/pages/local/LocalMyPage'
import LocalCart from '@/pages/local/LocalCart'
import LocalOrderComplete from '@/pages/local/LocalOrderComplete'
import LocalProfile from '@/pages/local/LocalProfile'
import ConsumerRegisterForm from '@/pages/local/ConsumerRegisterForm'
import LocalBottomNav from '@/components/local/LocalBottomNav'
import LocalFloatingCartButton from '@/components/local/LocalFloatingCartButton'
import Loading from '@/components/Loading'
import type { Consumer } from '@/types'

// LINEログイン設定
const SKIP_LINE_LOGIN = false // 本番環境: LINEログインを有効化

const LocalApp = () => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [needsRegistration, setNeedsRegistration] = useState(false)
    const [idToken, setIdToken] = useState<string | null>(null)

    const consumer = useStore(state => state.consumer)
    const setConsumer = useStore(state => state.setConsumer)
    const setLineUserId = useStore(state => state.setLineUserId)
    const setUserRole = useStore(state => state.setUserRole)
    const setRestaurant = useStore(state => state.setRestaurant)
    const setFarmer = useStore(state => state.setFarmer)
    const clearCart = useStore(state => state.clearCart)

    const location = useLocation()

    useEffect(() => {
        const init = async () => {
            try {
                // 【開発用】LINEログインをスキップして直接登録フォームを表示
                if (SKIP_LINE_LOGIN) {
                    console.log('🔧 開発モード: LINEログインをスキップしています')
                    setLineUserId('dev-user-id')
                    setUserRole('consumer')
                    setRestaurant(null)
                    setFarmer(null)
                    setConsumer(null)
                    clearCart()
                    setIdToken('dev-token')
                    setNeedsRegistration(true)
                    setLoading(false)
                    return
                }

                await liffService.init()

                if (!liffService.isLoggedIn()) {
                    if (liffService.isInClient()) {
                        liffService.login()
                        return
                    }
                    if (window.location.hostname !== 'localhost') {
                        liffService.login()
                        return
                    }
                }

                const token = liffService.getIDToken() || liffService.getStoredIDToken()
                if (!token) {
                    setError('LINEの認証情報が取得できませんでした。LINEから再度アクセスしてください。')
                    setLoading(false)
                    return
                }

                setIdToken(token)

                const response = await consumerApi.verify({ id_token: token })
                const data = response.data

                setLineUserId(data.line_user_id)
                setUserRole('consumer')
                setRestaurant(null)
                setFarmer(null)

                if (data.is_registered && data.consumer) {
                    setConsumer(data.consumer)
                    setNeedsRegistration(false)
                } else {
                    // DBにユーザーが存在しない場合、登録フォームを表示
                    console.log('初回ログイン: 登録フォームを表示します')
                    setConsumer(null)
                    clearCart()
                    setNeedsRegistration(true)
                }

                setLoading(false)
            } catch (err: any) {
                console.error('Local consumer initialization error', err)
                // 認証エラーの場合は登録フォームを表示
                if (err?.response?.status === 404 || err?.response?.status === 401) {
                    console.log('ユーザーが未登録: 登録フォームを表示します')
                    setNeedsRegistration(true)
                    setLoading(false)
                } else {
                    setError('アプリの初期化に失敗しました。時間をおいて再度アクセスしてください。')
                    setLoading(false)
                }
            }
        }

        init()
    }, [setConsumer, setFarmer, setLineUserId, setRestaurant, setUserRole, clearCart])

    const handleRegistrationSuccess = (registered: Consumer) => {
        setConsumer(registered)
        setNeedsRegistration(false)
    }

    const handleRetry = () => {
        window.location.reload()
    }

    if (loading) {
        return <Loading message="ベジコベを読み込んでいます..." />
    }

    if (error) {
        return (
            <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center px-4 text-center space-y-4">
                <AlertCircle className="text-emerald-600" size={40} />
                <div className="space-y-2">
                    <h1 className="text-xl font-semibold text-gray-900">エラーが発生しました</h1>
                    <p className="text-sm text-gray-600">{error}</p>
                </div>
                <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center justify-center px-5 py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700"
                >
                    再試行する
                </button>
            </div>
        )
    }

    if (needsRegistration) {
        return <ConsumerRegisterForm idToken={idToken} onSuccess={handleRegistrationSuccess} onRetry={handleRetry} />
    }

    if (!consumer) {
        return <Loading message="会員情報を取得しています..." />
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-16">
            <main className="pb-4">
                <Routes>
                    <Route index element={<LocalHome />} />
                    <Route path="search" element={<LocalSearch />} />
                    <Route path="farmers" element={<LocalFarmers />} />
                    <Route path="farmers/:id" element={<LocalFarmerDetail />} />
                    <Route path="mypage" element={<LocalMyPage />} />
                    <Route path="cart" element={<LocalCart />} />
                    <Route path="order-complete/:orderId" element={<LocalOrderComplete />} />
                    <Route path="profile" element={<LocalProfile />} />
                    <Route
                        path="*"
                        element={
                            <div className="max-w-3xl mx-auto px-4 py-10 text-center text-gray-600">
                                ページが見つかりませんでした。
                            </div>
                        }
                    />
                </Routes>
            </main>

            {/* カート画面以外でフローティングカートボタンを表示 */}
            {location.pathname !== '/local/cart' && <LocalFloatingCartButton />}

            <LocalBottomNav />
        </div>
    )
}

export default LocalApp
