import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Menu, LayoutList, Bell, Loader2, LogOut, User } from 'lucide-react';
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { MainPage } from './pages/MainPage';
import { Projects } from './pages/Projects';
import { ProjectDetails } from './pages/ProjectDetails';
import { ChapterDetails } from './pages/ChapterDetails';
import { MyTasks } from './pages/MyTasks';
import { MyProjects } from './pages/MyProjects';
import { MyProfileSettings } from './pages/MyProfileSettings';
import { ExternalDetailPage } from './pages/ExternalDetailPage';
import { TaskDetails } from './pages/TaskDetails';
import { Team } from './pages/Team';
import { UserDetails } from './pages/UserDetails';
import { Settings } from './pages/Settings';
import { CalendarPage } from './pages/CalendarPage';
import { ClassifiedsPage } from './pages/ClassifiedsPage';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { GlobalAlertProvider, useGlobalAlert } from './components/GlobalAlert';
import { setupOnMessage } from './lib/notifications';
import { WelcomeNotificationModal } from './components/WelcomeNotificationModal';
import { LoginPage } from './pages/LoginPage';
import { UpdatePasswordPage } from './pages/UpdatePasswordPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { isExternalOnlyProfile } from './lib/access';
import { getCurrentNotificationTokenRecord, isMobilePwaDevice } from './lib/notificationTokens';

// Admin Pages
import { AdminPage } from './pages/AdminPage';
import { ProjectManagerPage } from './pages/admin/ProjectManagerPage';
import { ChapterChairPage } from './pages/admin/ChapterChairPage';
import { PresidentPage } from './pages/admin/PresidentPage';
import { VToolsReportPage } from './pages/admin/VToolsReportPage';
import { FinancialPage } from './pages/admin/FinancialPage';
import { AvisaIEEEPage } from './pages/admin/AvisaIEEEPage';

const AppLayout = () => {
  const WELCOME_NOTIFICATION_DISMISSED_KEY = 'welcomeNotificationDismissedThisSession';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { loading } = useData();
  const { user, profile, signOut } = useAuth();
  const [showSignOut, setShowSignOut] = useState(false);
  const { showAlert } = useGlobalAlert();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (!profile || loading) return;
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') return;

    let isActive = true;
    let modalTimer: number | undefined;

    if (!isMobilePwaDevice()) return;

    const shouldPromptForNotifications = async () => {
      if (sessionStorage.getItem(WELCOME_NOTIFICATION_DISMISSED_KEY)) return;

      if (Notification.permission === 'default') {
        modalTimer = window.setTimeout(() => setShowWelcomeModal(true), 2000);
        return;
      }

      try {
        const tokenRecord = await getCurrentNotificationTokenRecord(profile.id);
        if (isActive && (!tokenRecord || !tokenRecord.enabled)) {
          modalTimer = window.setTimeout(() => setShowWelcomeModal(true), 2000);
        }
      } catch (error) {
        console.error('Erro ao verificar token de notificação do dispositivo:', error);
      }
    };

    shouldPromptForNotifications();

    return () => {
      isActive = false;
      if (modalTimer) {
        window.clearTimeout(modalTimer);
      }
    };
  }, [profile?.id, loading]);

  useEffect(() => {
    const unsubscribe = setupOnMessage((payload: any) => {
      showAlert(
        payload.notification?.title || 'Nova Notificação',
        payload.notification?.body || 'Você tem uma nova mensagem.',
        'info'
      );
    });
    return () => unsubscribe();
  }, [showAlert]);


  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-blue-600 gap-4">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="font-medium text-gray-600">Carregando ProjectHub...</p>
      </div>
    );
  }

  if (isExternalOnlyProfile(profile)) {
    return <Navigate to="/my-projects" replace />;
  }

  // Se o usuário não tiver perfil carregado ainda, mostra um loading ou avatar padrão
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const displayRole = profile?.role || 'Membro';
  const displayAvatar = profile?.avatar_initials || displayName[0].toUpperCase();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 h-16 md:h-20 flex items-center shrink-0 z-10">
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:block p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LayoutList className="w-5 h-5" />
              </button>

              <div className="flex items-center ml-1 md:ml-4">
                <img
                  src="/assets/LogoRamoIEEE.png"
                  alt="Logo Ramo Estudantil IEEE UnB"
                  className="h-10 md:h-12 w-auto object-contain"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">

              <div className="relative">
                <button
                  onClick={() => setShowSignOut(!showSignOut)}
                  className="flex items-center gap-2 pl-2 md:pl-4 border-l border-gray-200 ml-1 md:ml-2 hover:bg-gray-50 rounded-lg p-1 transition-colors"
                >
                  <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm ring-2 ring-white overflow-hidden">
                    {profile?.photo_url ? (
                      <img src={profile.photo_url} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      displayAvatar
                    )}
                  </div>
                  <div className="text-sm hidden md:block text-left">
                    <p className="font-bold text-gray-800 leading-none">{displayName}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{displayRole}</p>
                  </div>
                </button>

                {showSignOut && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100 md:hidden">
                      <p className="font-bold text-gray-800 text-sm">{displayName}</p>
                      <p className="text-gray-500 text-xs">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setShowSignOut(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Meu Perfil
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair da Conta
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main id="app-main-scroll" className="flex-1 overflow-auto p-4 md:p-6">
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Rotas Comuns (Membros) */}
            <Route path="/tasks" element={<MyTasks />} />
            <Route path="/tasks/:taskId" element={<TaskDetails />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<ProjectDetails />} />
            <Route path="/chapters/:id" element={<ChapterDetails />} />
            <Route path="/team" element={<Team />} />
            <Route path="/team/:id" element={<UserDetails />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/classifieds" element={<ClassifiedsPage />} />

            {/* Rotas Administrativas - Protegidas */}
            {/* 1. Rotas para Todos os Níveis de Gestão (Manager, Chair, Admin) */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'chair', 'manager']} />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/project-manager" element={<ProjectManagerPage />} />
              <Route path="/admin/vtools-report" element={<VToolsReportPage />} />
            </Route>

            {/* 2. Rotas para Liderança do Capítulo (Chair, Admin) - Manager não entra mais aqui */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'chair']} />}>
              <Route path="/admin/chapter-chair" element={<ChapterChairPage />} />
              <Route path="/admin/financial" element={<FinancialPage />} />
            </Route>

            {/* 3. Rotas Exclusivas da Presidência Global (Apenas Admin) */}
	            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
	              <Route path="/admin/president" element={<PresidentPage />} />
	              <Route path="/admin/avisaieee" element={<AvisaIEEEPage />} />
	            </Route>
          </Routes>
        </main>
      </div>



      <PWAInstallPrompt />
      <WelcomeNotificationModal
        isOpen={showWelcomeModal}
        onClose={() => {
          setShowWelcomeModal(false);
          sessionStorage.setItem(WELCOME_NOTIFICATION_DISMISSED_KEY, 'true');
        }}
      />
    </div >
  );
}



export function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <DataProvider>
          <GlobalAlertProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/update-password" element={<UpdatePasswordPage />} />


              {/* Private Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/my-projects" element={<MyProjects />} />
                <Route
                  path="/my-projects/projects/:projectId"
                  element={<ExternalDetailPage title="Detalhes do projeto"><ProjectDetails /></ExternalDetailPage>}
                />
                <Route
                  path="/my-projects/tasks/:taskId"
                  element={<ExternalDetailPage title="Detalhes da tarefa"><TaskDetails /></ExternalDetailPage>}
                />
                <Route path="/my-profile" element={<MyProfileSettings />} />
                <Route path="/*" element={<AppLayout />} />
              </Route>
            </Routes>
          </GlobalAlertProvider>
        </DataProvider>
      </AuthProvider>
    </Router>
  );
}
