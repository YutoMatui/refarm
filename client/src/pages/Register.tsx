import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Store, MapPin, Phone, Mail, Clock, FileText } from 'lucide-react'
import { authApi } from '@/services/api'
import { liffService } from '@/services/liff'
import { useStore } from '@/store/useStore'
import Loading from '@/components/Loading'

interface RegisterFormData {
    name: string
    phone_number: string
    address: string
    invoice_email?: string
    business_hours?: string
    notes?: string
}

export default function Register() {
    const navigate = useNavigate()
    const { setRestaurant, setLineUserId } = useStore()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterFormData>()

    const onSubmit = async (data: RegisterFormData) => {
        try {
            setIsSubmitting(true)
            const idToken = liffService.getIDToken() || liffService.getStoredIDToken()

            if (!idToken) {
                toast.error('LINEログイン情報の取得に失敗しました')
                return
            }

            const response = await authApi.register({
                ...data,
                id_token: idToken,
            })

            const { restaurant, line_user_id } = response.data

            if (restaurant) {
                setRestaurant(restaurant)
                setLineUserId(line_user_id)
                toast.success('登録が完了しました')
                navigate('/catalog')
            } else {
                throw new Error('登録に失敗しました')
            }
        } catch (error) {
            console.error('Registration failed:', error)
            toast.error('登録に失敗しました。もう一度お試しください。')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isSubmitting) {
        return <Loading message="登録処理中..." />
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                    <Store className="mx-auto h-12 w-12 text-green-600" />
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        利用登録
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        サービスを利用するには、以下の情報を入力してください
                    </p>
                </div>

                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        {/* Restaurant Name */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                店舗名 <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Store className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    id="name"
                                    className={`focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md ${errors.name ? 'border-red-300' : ''
                                        }`}
                                    placeholder="例: イタリアン食堂 神戸店"
                                    {...register('name', { required: '店舗名は必須です' })}
                                />
                            </div>
                            {errors.name && (
                                <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>
                            )}
                        </div>

                        {/* Phone Number */}
                        <div>
                            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                                電話番号 <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="tel"
                                    id="phone_number"
                                    className={`focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md ${errors.phone_number ? 'border-red-300' : ''
                                        }`}
                                    placeholder="例: 078-123-4567"
                                    {...register('phone_number', {
                                        required: '電話番号は必須です',
                                        pattern: {
                                            value: /^[\d-]+$/,
                                            message: '正しい電話番号を入力してください',
                                        },
                                    })}
                                />
                            </div>
                            {errors.phone_number && (
                                <p className="mt-2 text-sm text-red-600">{errors.phone_number.message}</p>
                            )}
                        </div>

                        {/* Address */}
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                                住所 (納品先) <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPin className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    id="address"
                                    className={`focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md ${errors.address ? 'border-red-300' : ''
                                        }`}
                                    placeholder="例: 神戸市中央区..."
                                    {...register('address', { required: '住所は必須です' })}
                                />
                            </div>
                            {errors.address && (
                                <p className="mt-2 text-sm text-red-600">{errors.address.message}</p>
                            )}
                        </div>

                        {/* Email (Optional) */}
                        <div>
                            <label htmlFor="invoice_email" className="block text-sm font-medium text-gray-700">
                                請求書送付先メールアドレス (任意)
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    id="invoice_email"
                                    className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                                    placeholder="billing@example.com"
                                    {...register('invoice_email', {
                                        pattern: {
                                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                            message: '正しいメールアドレスを入力してください',
                                        },
                                    })}
                                />
                            </div>
                            {errors.invoice_email && (
                                <p className="mt-2 text-sm text-red-600">{errors.invoice_email.message}</p>
                            )}
                        </div>

                        {/* Business Hours (Optional) */}
                        <div>
                            <label htmlFor="business_hours" className="block text-sm font-medium text-gray-700">
                                営業時間 (任意)
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Clock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    id="business_hours"
                                    className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                                    placeholder="例: 10:00-22:00"
                                    {...register('business_hours')}
                                />
                            </div>
                        </div>

                        {/* Notes (Optional) */}
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                                備考 (任意)
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                                    <FileText className="h-5 w-5 text-gray-400" />
                                </div>
                                <textarea
                                    id="notes"
                                    rows={3}
                                    className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                                    placeholder="納品時の注意事項など"
                                    {...register('notes')}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                                    }`}
                            >
                                {isSubmitting ? '登録中...' : '登録する'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
