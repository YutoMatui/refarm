import { useEffect } from 'react';
import { liffService } from '../services/liff';
import Loading from '../components/Loading';

export default function Login() {
    useEffect(() => {
        // Trigger LINE Login
        if (!liffService.isLoggedIn() && liffService.isInClient()) {
            liffService.login();
        } else if (!liffService.isInClient()) {
            // Web browser login
            liffService.login();
        }
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <Loading message="LINEログイン画面へ移動します..." />
            <div className="mt-8 text-center">
                <p className="text-gray-600 mb-4">画面が切り替わらない場合は下のボタンを押してください</p>
                <button
                    onClick={() => liffService.login()}
                    className="bg-[#06C755] text-white font-bold py-3 px-8 rounded-lg shadow hover:bg-[#05b34c] transition-colors"
                >
                    LINEでログイン
                </button>
            </div>
        </div>
    );
}
