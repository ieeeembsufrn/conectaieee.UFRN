import React from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Settings } from './Settings';
import { useAuth } from '../context/AuthContext';

export const MyProfileSettings = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/my-projects')}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img
              src="/assets/LogoRamoIEEE.png"
              alt="Logo Ramo Estudantil IEEE UnB"
              className="h-11 sm:h-12 w-auto object-contain shrink-0"
            />
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Editar perfil</p>
              <p className="text-xs text-slate-500 truncate">Área externa de acompanhamento</p>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="h-10 px-4 rounded-lg border border-red-100 text-red-600 bg-white text-sm font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 sm:py-8">
        <Settings />
      </main>
    </div>
  );
};
