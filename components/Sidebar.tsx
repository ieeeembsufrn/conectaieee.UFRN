
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FolderKanban, X, ClipboardList, LayoutGrid, Briefcase, Users, Settings, LogOut, Home, Calendar, Newspaper, Shield, Book } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ sidebarOpen, setSidebarOpen, mobileMenuOpen, setMobileMenuOpen }: any) => {
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const menuItems = [
    { id: '/', icon: Home, label: 'Início' },
    { id: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { id: '/tasks', icon: ClipboardList, label: 'Minhas Tarefas' },
    { id: '/projects', icon: Briefcase, label: 'Projetos' },
    { id: '/calendar', icon: Calendar, label: 'Calendário' },
    { id: '/classifieds', icon: Newspaper, label: 'Classificados' },
  ];

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}

      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarOpen || mobileMenuOpen ? 'w-64' : 'w-20'}
        bg-gradient-to-b from-blue-600 to-blue-800 text-white 
        transition-all duration-300 flex flex-col
      `}>
        <div className="p-4 border-b border-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-blue-600" />
              </div>
              {(sidebarOpen || mobileMenuOpen) && (
                <div>
                  <h1 className="font-bold text-base md:text-lg">ConectaIEEE</h1>
                  <p className="text-xs text-blue-200 truncate">UFRN - Power By UnB</p>
                </div>
              )}
            </div>
            <button
              className="lg:hidden text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.id}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white text-blue-600' : 'hover:bg-blue-700'
                  }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {(sidebarOpen || mobileMenuOpen) && <span className="font-medium truncate">{item.label}</span>}
              </NavLink>
            );
          })}

          <NavLink
            to="/team"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white text-blue-600' : 'hover:bg-blue-700'
              }`}
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            {(sidebarOpen || mobileMenuOpen) && <span className="font-medium">Equipe</span>}
          </NavLink>

          <a
            href="https://sites.google.com/view/ramoieeeunb-tutoriais/p%C3%A1gina-inicial"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-blue-700"
          >
            <Book className="w-5 h-5 flex-shrink-0" />
            {(sidebarOpen || mobileMenuOpen) && <span className="font-medium">Biblioteca IEEE</span>}
          </a>

          {/* Divisória e Funções Administrativas */}
          {/* Divisória e Funções Administrativas */}
          {(function () {
            const chapters = (profile as any)?.profile_chapters || profile?.profileChapters || [];
            const userRoles = chapters?.map((pc: any) => pc.permission_slug) || [];
            const canAccessAdmin = userRoles.some((role: string) => ['admin', 'chair', 'manager'].includes(role));

            if (!canAccessAdmin) return null;

            return (
              <div className="pt-2 border-t border-blue-500/50 mt-2">
                <NavLink
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white text-blue-600' : 'hover:bg-blue-700'
                    }`}
                >
                  <Shield className="w-5 h-5 flex-shrink-0" />
                  {(sidebarOpen || mobileMenuOpen) && <span className="font-medium">Admin</span>}
                </NavLink>
              </div>
            );
          })()}
        </nav>

        <div className="p-4 border-t border-blue-500 space-y-2">
          <NavLink
            to="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white text-blue-600' : 'hover:bg-blue-700'
              }`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {(sidebarOpen || mobileMenuOpen) && <span className="font-medium">Configurações</span>}
          </NavLink>
          <button
            onClick={async () => {
              await signOut();
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors text-white"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {(sidebarOpen || mobileMenuOpen) && <span className="font-medium">Sair</span>}
          </button>
        </div>
      </div>
    </>
  );
};
