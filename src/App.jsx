import React, { useState, useEffect } from 'react';
import { supabase } from './supabase/config';
import Navbar from './components/Navbar';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import UploadPage from './components/UploadPage';
import EditorPage from './components/EditorPage';
import HistoryPage from './components/HistoryPage';
import AnalyticsPage from './components/AnalyticsPage';
import SettingsPage from './components/SettingsPage';

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setCurrentPage('upload');
      } else {
        setCurrentPage('login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setCurrentPage('upload');
      } else {
        setCurrentPage('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleImageSelected = (image) => {
    setSelectedImage(image);
    setCurrentPage('editor');
  };

  const handleBackToUpload = () => {
    setSelectedImage(null);
    setCurrentPage('upload');
  };

  const handlePageChange = (page) => {
    if (page === 'upload') {
      setSelectedImage(null);
    }
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    if (currentPage === 'signup') {
      return <SignupPage onSwitchToLogin={() => setCurrentPage('login')} />;
    }
    return <LoginPage onSwitchToSignup={() => setCurrentPage('signup')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navbar 
        currentPage={currentPage}
        setCurrentPage={handlePageChange}
        user={user}
      />
      
      {currentPage === 'upload' && (
        <UploadPage onImageSelected={handleImageSelected} key={currentPage} />
      )}
      {currentPage === 'editor' && selectedImage && (
        <EditorPage 
          image={selectedImage} 
          onBack={handleBackToUpload}
          userId={user.id}
        />
      )}
      {currentPage === 'history' && (
        <HistoryPage userId={user.id} />
      )}
      {currentPage === 'analytics' && (
        <AnalyticsPage userId={user.id} />
      )}
      {currentPage === 'settings' && (
        <SettingsPage user={user} />
      )}
    </div>
  );
}

export default App;