import { useState, useEffect } from 'react';
import { adminApi } from '@/services/api';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Trash2, Shield, User } from 'lucide-react';

interface AdminUser {
    id: number;
    email: string;
    role: string;
    created_at: string;
}

export default function AdminUserManagement() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('editor');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const res = await adminApi.listUsers();
            setUsers(res.data);
        } catch (e) {
            console.error(e);
            toast.error('管理者一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (user?: AdminUser) => {
        if (user) {
            setEditingUser(user);
            setEmail(user.email);
            setRole(user.role);
            setPassword(''); // Password empty for update (only if changing)
        } else {
            setEditingUser(null);
            setEmail('');
            setRole('editor');
            setPassword('');
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (editingUser) {
                // Update
                const payload: any = { email, role };
                if (password) payload.password = password;

                await adminApi.updateUser(editingUser.id, payload);
                toast.success('更新しました');
            } else {
                // Create
                if (!password) {
                    toast.error('パスワードを入力してください');
                    setSubmitting(false);
                    return;
                }
                await adminApi.createUser({ email, password, role });
                toast.success('作成しました');
            }
            setIsModalOpen(false);
            loadUsers();
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.detail || '保存に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('本当に削除しますか？')) return;
        try {
            await adminApi.deleteUser(id);
            toast.success('削除しました');
            loadUsers();
        } catch (e: any) {
            toast.error(e.response?.data?.detail || '削除に失敗しました');
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">管理者アカウント管理</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        管理画面にアクセスできるユーザーを追加・編集します
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <Plus size={18} />
                    新規追加
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">権限</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">作成日</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-900">#{user.id}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.email}</td>
                                <td className="px-6 py-4 text-sm">
                                    {user.role === 'super_admin' ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                            <Shield size={12} className="mr-1" />
                                            管理者 (Super Admin)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            <User size={12} className="mr-1" />
                                            編集者 (Editor)
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {new Date(user.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => handleOpenModal(user)}
                                        className="text-blue-600 hover:text-blue-800 p-2 bg-blue-50 rounded-full"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="text-red-600 hover:text-red-800 p-2 bg-red-50 rounded-full"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h3 className="text-lg font-bold mb-4">
                            {editingUser ? '管理者情報の編集' : '新規管理者作成'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    パスワード
                                    {editingUser && <span className="text-xs font-normal text-gray-500 ml-2">※変更する場合のみ入力</span>}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2"
                                    placeholder={editingUser ? "変更しない場合は空欄" : ""}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">権限 (Role)</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2"
                                >
                                    <option value="editor">編集者 (Editor) - 一般管理操作のみ</option>
                                    <option value="super_admin">管理者 (Super Admin) - 全権限</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-50"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex justify-center items-center"
                                >
                                    {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
                                    保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
