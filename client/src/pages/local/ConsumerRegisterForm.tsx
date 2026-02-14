import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { consumerApi } from '@/services/api'
import type { Consumer } from '@/types'
import Loading from '@/components/Loading'

interface ConsumerRegisterFormProps {
    idToken: string | null
    onSuccess: (consumer: Consumer) => void
    onRetry?: () => void
}

interface Organization {
    id: number
    name: string
    address: string
    phone_number: string
}

const ConsumerRegisterForm = ({ idToken, onSuccess, onRetry }: ConsumerRegisterFormProps) => {
    const [name, setName] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [selectedOrgId, setSelectedOrgId] = useState<number | ''>('')
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [isLoadingOrgs, setIsLoadingOrgs] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        const fetchOrganizations = async () => {
            try {
                const response = await consumerApi.getOrganizations()
                setOrganizations(response.data.items)
                // デフォルトで最初の組織を選択してもよいが、明示的に選択させる
            } catch (error) {
                console.error("Failed to fetch organizations", error)
                toast.error("組織情報の取得に失敗しました")
            } finally {
                setIsLoadingOrgs(false)
            }
        }
        fetchOrganizations()
    }, [])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!name || !phoneNumber || !selectedOrgId) {
            toast.error('全ての必須項目を入力してください')
            return
        }

        setIsSubmitting(true)
        try {
            // 【開発用】idTokenがdev-tokenの場合はダミーデータで成功させる
            if (idToken === 'dev-token') {
                console.log('🔧 開発モード: ダミー登録データで進めます')
                const dummyConsumer: Consumer = {
                    id: 9999,
                    line_user_id: 'dev-user-id',
                    name,
                    phone_number: phoneNumber,
                    postal_code: null,
                    address: null,
                    building: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    organization_id: Number(selectedOrgId)
                }
                await new Promise(resolve => setTimeout(resolve, 500)) // 少し待機
                toast.success('会員登録が完了しました（開発モード）')
                onSuccess(dummyConsumer)
                return
            }

            if (!idToken) {
                toast.error('LINEの認証情報が取得できませんでした。再度LINEからアクセスしてください。')
                onRetry?.()
                return
            }

            const response = await consumerApi.register({
                id_token: idToken,
                name,
                phone_number: phoneNumber,
                postal_code: undefined,
                address: undefined,
                building: undefined,
                organization_id: Number(selectedOrgId)
            })

            toast.success('会員登録が完了しました')
            onSuccess(response.data)
        } catch (error: any) {
            console.error('Consumer registration failed', error)
            const message = error?.response?.data?.message ?? '登録に失敗しました'
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoadingOrgs) return <Loading message="読み込み中..." />

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 space-y-6">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">ベジコベ 会員登録</h1>
                    <p className="text-sm text-gray-600">
                        サービスを利用するために必要な情報を入力してください。
                    </p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">お名前（フルネーム） <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例）山田 太郎"
                            required
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">電話番号（緊急連絡先） <span className="text-red-500">*</span></label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="例）08012345678"
                            required
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">所属組織・受取場所 <span className="text-red-500">*</span></label>
                        <select
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(Number(e.target.value))}
                            required
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="">選択してください</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>
                                    {org.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500">
                            商品を受け取る組織（キャンパス等）を選択してください。
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? '登録中...' : '会員登録する'}
                    </button>
                </form>

                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="w-full text-sm text-gray-500 underline"
                    >
                        認証をやり直す
                    </button>
                )}
            </div>
        </div>
    )
}

export default ConsumerRegisterForm
