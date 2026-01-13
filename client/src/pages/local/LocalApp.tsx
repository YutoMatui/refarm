import { useEffect, useMemo, useState } from 'react'
import { Link, Routes, Route, useLocation } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { liffService } from '@/services/liff'
import { consumerApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import LocalHome from '@/pages/local/LocalHome'
import LocalCart from '@/pages/local/LocalCart'
import LocalOrderComplete from '@/pages/local/LocalOrderComplete'
import LocalProfile from '@/pages/local/LocalProfile'
import ConsumerRegisterForm from '@/pages/local/ConsumerRegisterForm'
import LocalFloatingCartButton from '@/components/local/LocalFloatingCartButton'
import Loading from '@/components/Loading'
import type { Consumer } from '@/types'

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
                    setConsumer(null)
                    clearCart()
                    setNeedsRegistration(true)
                }

                setLoading(false)
            } catch (err) {
                console.error('Local consumer initialization error', err)
                setError('アプリの初期化に失敗しました。時間をおいて再度アクセスしてください。')
                setLoading(false)
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

    const showCartButton = useMemo(() => {
        return location.pathname === '/local' || location.pathname === '/local/'
    }, [location.pathname])

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
        <div className="min-h-screen bg-gray-50">
            <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Vegicobe Local</p>
                        <h1 className="text-xl font-bold text-gray-900">{consumer.name} 様</h1>
                        <p className="text-xs text-gray-500">ご登録住所: {consumer.address}{(consumer.building && consumer.building !== 'なし') ? ` ${consumer.building}` : ''}</p>
                    </div>
                    <nav className="flex items-center gap-2">
                        <Link
                            to="/local"
                            className={`px-3 py-2 text-sm font-semibold rounded-md ${location.pathname === '/local' ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-emerald-50'}`}
                        >
                            商品一覧
                        </Link>
                        <Link
                            to="/local/cart"
                            className={`px-3 py-2 text-sm font-semibold rounded-md ${location.pathname.startsWith('/local/cart') ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-emerald-50'}`}
                        >
                            カート
                        </Link>
                        <Link
                            to="/local/profile"
                            className={`px-3 py-2 text-sm font-semibold rounded-md ${location.pathname.startsWith('/local/profile') ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-emerald-50'}`}
                        >
                            登録情報
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="pb-24">
                <Routes>
                    <Route index element={<LocalHome />} />
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

            {showCartButton && <LocalFloatingCartButton />}
        </div>
    )
}

export default LocalApp
