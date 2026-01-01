import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '@/services/api'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'


export default function AdminLogin() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const formData = new FormData()
            formData.append('username', email) // OAuth2PasswordRequestForm expects 'username'
            formData.append('password', password)

            const response = await adminApi.login(formData)

            // Store token
            localStorage.setItem('admin_token', response.data.access_token)

            toast.success('ログインしました')
            navigate('/admin')
        } catch (error) {
            console.error('Login error:', error)
            toast.error('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">管理者ログイン</h1>
                    <p className="text-sm text-gray-500 mt-2">管理画面へアクセスするにはログインしてください</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            メールアドレス
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:outline-none"
                            placeholder="admin@refarmkobe.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            パスワード
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:outline-none"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            'ログイン'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
