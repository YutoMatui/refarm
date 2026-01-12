import { Link } from 'lucide-react';

export default function LinkAccountGuide() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Link className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-4">アカウント連携が必要です</h1>
                <p className="text-gray-600 mb-6 leading-relaxed">
                    このLINEアカウントはまだ連携されていません。<br />
                    管理者または店舗から共有された<br />
                    <span className="font-bold text-green-700">招待URL</span><br />
                    からアクセスして、連携を完了してください。
                </p>
                <div className="text-sm text-gray-400 bg-gray-50 p-4 rounded-lg">
                    ※招待URLをお持ちでない場合は、メッセージにてお問い合わせください。
                </div>
            </div>
        </div>
    );
}
