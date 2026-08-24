import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, X, RefreshCw } from 'lucide-react';

interface PWAInstallPromptProps {
  onInstall?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onInstall }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Use o hook oficial para gerenciar o SW
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW Registration Error', error);
    },
  });

  useEffect(() => {
    // Evento de instalação do PWA (para "Adicionar à Tela Inicial")
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      setShowInstallPrompt(true);
    };

    // Evento de instalação concluída
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setShowInstallPrompt(false);
      console.log('PWA instalado com sucesso');
    };

    // Atualização disponível vinda do hook
    if (needRefresh) {
      setUpdateAvailable(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [needRefresh]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      onInstall?.();
    }
  };

  const handleUpdateClick = () => {
    // Força a atualização do SW e reload
    updateServiceWorker(true);
  };

  const dismissPrompt = () => {
    setShowInstallPrompt(false);
    // Não mostra novamente nesta sessão
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Não mostra se já foi dispensado recentemente
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) {
      setShowInstallPrompt(false);
    }
  }, []);

  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
        <div className="flex items-start space-x-3">
          <RefreshCw className="w-6 h-6 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Atualização Disponível</h3>
            <p className="text-sm opacity-90 mb-3">
              Uma nova versão do IEEE ProjectHub está disponível.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={handleUpdateClick}
                className="bg-white text-blue-600 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Atualizar Agora
              </button>
              <button
                onClick={() => setUpdateAvailable(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!showInstallPrompt || !isInstallable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-gray-200 p-4 rounded-lg shadow-lg z-50">
      <div className="flex items-start space-x-3">
        <Download className="w-6 h-6 mt-0.5 text-blue-600 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Instalar App</h3>
          <p className="text-sm text-gray-600 mb-3">
            Instale o IEEE ProjectHub no seu dispositivo para acesso rápido e funcionamento offline.
          </p>
          <div className="flex space-x-2">
            <button
              onClick={handleInstallClick}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Instalar
            </button>
            <button
              onClick={dismissPrompt}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook para detectar se é PWA
export const useIsPWA = () => {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const checkIfPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (navigator as any).standalone === true;

      setIsPWA(isStandalone || isNavigatorStandalone);
    };

    checkIfPWA();
  }, []);

  return isPWA;
};

// Hook para status de conectividade
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
