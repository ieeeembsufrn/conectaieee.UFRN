import React, { useState } from 'react';
import { Bell, X, ShieldCheck } from 'lucide-react';
import { requestNotificationPermission } from '../lib/notifications';
import { useAuth } from '../context/AuthContext';

interface WelcomeNotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const WelcomeNotificationModal: React.FC<WelcomeNotificationModalProps> = ({ isOpen, onClose }) => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleEnable = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            const token = await requestNotificationPermission(profile.id);
            if (token) {
                // Sucesso, fecha o modal
                onClose();
            } else {
                // Permissão negada ou erro, fecha também para não insistir
                onClose();
            }
        } catch (error) {
            console.error(error);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header Visual */}
                <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-700 relative flex items-center justify-center">
                    <div className="absolute top-0 right-0 p-3">
                        <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 p-1 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex flex-col items-center gap-2 z-10">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-inner ring-4 ring-white/10">
                            <Bell className="w-8 h-8 text-white fill-white" />
                        </div>
                    </div>

                    {/* Decorative circles */}
                    <div className="absolute top-[-20%] left-[-20%] w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-32 h-32 bg-black/10 rounded-full blur-xl"></div>
                </div>

                {/* Content */}
                <div className="p-6 text-center">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Fique por dentro!</h2>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                        Ative as notificações para receber atualizações sobre seus projetos, tarefas e mensagens importantes em tempo real.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={handleEnable}
                            disabled={loading}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span>Ativando...</span>
                            ) : (
                                <>
                                    <ShieldCheck className="w-5 h-5" />
                                    Ativar Notificações
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-medium rounded-xl transition-colors disabled:opacity-50"
                        >
                            Agora não
                        </button>

                    </div>

                    <p className="text-xs text-gray-400 mt-4">
                        Você pode alterar isso depois nas configurações.
                    </p>
                </div>
            </div>
        </div>
    );
};
