import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RegistrationGuard } from './components/RegistrationGuard';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { RequestsPage } from './pages/RequestsPage';
import { CreateRequestPage } from './pages/CreateRequestPage';
import { DonationsPage } from './pages/DonationsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthCallback } from './pages/AuthCallback';
import { CompleteRegistration } from './pages/CompleteRegistration';
import { ProfilePage } from './pages/ProfilePage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/complete-registration" element={
                <ProtectedRoute>
                  <CompleteRegistration />
                </ProtectedRoute>
              } />

              {/* Protected Routes with Registration Guard */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <RegistrationGuard>
                    <DashboardPage />
                  </RegistrationGuard>
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <RegistrationGuard>
                    <ProfilePage />
                  </RegistrationGuard>
                </ProtectedRoute>
              } />
              <Route path="/requests" element={
                <ProtectedRoute>
                  <RegistrationGuard>
                    <RequestsPage />
                  </RegistrationGuard>
                </ProtectedRoute>
              } />
              <Route path="/requests/new" element={
                <ProtectedRoute>
                  <RegistrationGuard>
                    <CreateRequestPage />
                  </RegistrationGuard>
                </ProtectedRoute>
              } />
              <Route path="/donations" element={
                <ProtectedRoute>
                  <RegistrationGuard>
                    <DonationsPage />
                  </RegistrationGuard>
                </ProtectedRoute>
              } />
              <Route path="/achievements" element={
                <ProtectedRoute>
                  <RegistrationGuard>
                    <AchievementsPage />
                  </RegistrationGuard>
                </ProtectedRoute>
              } />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;