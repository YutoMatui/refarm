import { useState, useRef } from 'react';
import { Camera, Trash2, Plus, Loader2 } from 'lucide-react';
import { Achievement } from '@/types';
import { uploadApi } from '@/services/api';
import { toast } from 'sonner';
import { compressImage } from '@/utils/imageUtils';

interface AchievementEditorProps {
    achievements: Achievement[];
    onChange: (achievements: Achievement[]) => void;
}

export default function AchievementEditor({ achievements, onChange }: AchievementEditorProps) {
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);

    const handleAdd = () => {
        onChange([...achievements, { title: '', image_url: '' }]);
    };

    const handleRemove = (index: number) => {
        const newAchievements = [...achievements];
        newAchievements.splice(index, 1);
        onChange(newAchievements);
    };

    const handleChange = (index: number, field: keyof Achievement, value: string) => {
        const newAchievements = [...achievements];
        newAchievements[index] = { ...newAchievements[index], [field]: value };
        onChange(newAchievements);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingIndex(index);
        try {
            const compressedFile = await compressImage(file);
            const res = await uploadApi.uploadImage(compressedFile);
            handleChange(index, 'image_url', res.data.url);
            toast.success('画像をアップロードしました');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('アップロードに失敗しました');
        } finally {
            setUploadingIndex(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const triggerFileInput = (index: number) => {
        setCurrentEditIndex(index);
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-gray-700">実績・受賞歴</h3>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => currentEditIndex !== null && handleImageUpload(e, currentEditIndex)}
            />

            {achievements.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1"
                    >
                        <Trash2 size={18} />
                    </button>

                    {/* Image Upload */}
                    <div
                        onClick={() => triggerFileInput(index)}
                        className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden relative hover:opacity-80 transition-opacity border-2 border-white shadow-sm"
                    >
                        {item.image_url ? (
                            <img src={item.image_url} alt="achievement" className="w-full h-full object-cover" />
                        ) : (
                            <Camera className="text-gray-400" size={20} />
                        )}
                        {uploadingIndex === index && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Loader2 className="animate-spin text-white" size={16} />
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">内容</label>
                        <input
                            value={item.title}
                            onChange={(e) => handleChange(index, 'title', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                            placeholder="例: 第10回 神戸野菜グランプリ 金賞受賞"
                        />
                    </div>
                </div>
            ))}

            <button
                type="button"
                onClick={handleAdd}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={20} />
                実績を追加
            </button>
        </div>
    );
}
