import { useState, useRef } from 'react';
import { Camera, Trash2, Plus, Loader2 } from 'lucide-react';
import { Commitment } from '@/types';
import { uploadApi } from '@/services/api';
import { toast } from 'sonner';
import { compressImage } from '@/utils/imageUtils';

interface CommitmentEditorProps {
    commitments: Commitment[];
    onChange: (commitments: Commitment[]) => void;
}

export default function CommitmentEditor({ commitments, onChange }: CommitmentEditorProps) {
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);

    const handleAdd = () => {
        onChange([...commitments, { title: '', body: '', image_url: '' }]);
    };

    const handleRemove = (index: number) => {
        const newCommitments = [...commitments];
        newCommitments.splice(index, 1);
        onChange(newCommitments);
    };

    const handleChange = (index: number, field: keyof Commitment, value: string) => {
        const newCommitments = [...commitments];
        newCommitments[index] = { ...newCommitments[index], [field]: value };
        onChange(newCommitments);
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
            <h3 className="font-bold text-gray-700">こだわり（画像付き）</h3>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => currentEditIndex !== null && handleImageUpload(e, currentEditIndex)}
            />

            {commitments.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
                    <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1"
                    >
                        <Trash2 size={18} />
                    </button>

                    <div className="flex gap-4 items-start">
                        {/* Image Upload */}
                        <div
                            onClick={() => triggerFileInput(index)}
                            className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden relative hover:opacity-80 transition-opacity border-2 border-white shadow-sm"
                        >
                            {item.image_url ? (
                                <img src={item.image_url} alt="commitment" className="w-full h-full object-cover" />
                            ) : (
                                <Camera className="text-gray-400" size={24} />
                            )}
                            {uploadingIndex === index && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 className="animate-spin text-white" size={20} />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">タイトル</label>
                                <input
                                    value={item.title}
                                    onChange={(e) => handleChange(index, 'title', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                    placeholder="例: 土づくりへの執念"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">説明文</label>
                                <textarea
                                    value={item.body}
                                    onChange={(e) => handleChange(index, 'body', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                    rows={3}
                                    placeholder="こだわりの詳細を入力..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            <button
                type="button"
                onClick={handleAdd}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={20} />
                こだわりを追加
            </button>
        </div>
    );
}
