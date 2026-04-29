import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = '확인', cancelText = '취소', isDanger = false }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[#fdf3e3] rounded-lg shadow-xl max-w-sm w-full overflow-hidden border border-[#a78049]">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full mt-1 shrink-0 ${isDanger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                            {isDanger ? <AlertCircle size={24} /> : <Info size={24} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#5a5545]">{title}</h3>
                            <p className="text-sm text-[#7a7565] mt-2 whitespace-pre-line leading-relaxed">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-[#f5ead6] px-6 py-4 flex justify-end gap-3 border-t border-[#e8d5b5]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-[#7a7565] hover:bg-[#e8d5b5] rounded transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-4 py-2 text-sm font-bold text-white rounded transition-colors ${isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#a78049] hover:bg-[#c68426]'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function AlertModal({ isOpen, onClose, title, message, isSuccess = false }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[#fdf3e3] rounded-lg shadow-xl max-w-sm w-full overflow-hidden border border-[#a78049]">
                <div className="p-6 text-center relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-[#9a9585] hover:text-[#5a5545]">
                        <X size={20} />
                    </button>
                    <div className="flex justify-center mb-4">
                        <div className={`p-3 rounded-full ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {isSuccess ? <CheckCircle size={32} /> : <AlertCircle size={32} />}
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-[#5a5545] mb-2">{title}</h3>
                    <p className="text-sm text-[#7a7565] whitespace-pre-line">{message}</p>
                </div>
                <div className="bg-[#f5ead6] px-6 py-4 flex justify-center border-t border-[#e8d5b5]">
                    <button
                        onClick={onClose}
                        className="w-full max-w-[120px] px-4 py-2 text-sm font-bold bg-[#a78049] hover:bg-[#c68426] text-white rounded transition-colors"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
