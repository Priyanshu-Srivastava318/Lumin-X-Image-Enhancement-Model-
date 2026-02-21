import React, { useState } from 'react';
import { Menu, X, History, Settings, LogOut, User, BarChart3, Microscope, BookOpen } from 'lucide-react';
import { supabase } from '../supabase/config';

const Navbar = ({ currentPage, setCurrentPage, user }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      sessionStorage.removeItem('editorImage');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavClick = (pageId) => {
    if (pageId === 'upload') {
      const hasImage = sessionStorage.getItem('editorImage');
      if (hasImage) {
        setCurrentPage('editor');
      } else {
        setCurrentPage('upload');
      }
    } else {
      setCurrentPage(pageId);
    }
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'about',     label: 'About',     icon: BookOpen },
    { id: 'upload',    label: 'Enhance',   icon: Microscope },
    { id: 'history',   label: 'History',   icon: History },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings',  label: 'Settings',  icon: Settings },
  ];

  const isActive = (id) =>
    id === 'upload'
      ? currentPage === 'upload' || currentPage === 'editor'
      : currentPage === id;

  const username = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo — clicking goes to About */}
          <button onClick={() => handleNavClick('about')}
                  className="flex items-center gap-2 group">
            <BookOpen className="w-8 h-8 text-blue-400" />
            <div className="text-left">
              <span className="text-xl font-bold text-white">LuminX</span>
              <span className="text-xs text-slate-400 block -mt-1">Research Platform</span>
            </div>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                  isActive(id)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* User + logout */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg">
              <User className="w-4 h-4 text-slate-300" />
              <span className="text-sm text-slate-300">{username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-slate-700">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                  isActive(id)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            <div className="pt-2 border-t border-slate-700">
              <div className="flex items-center gap-2 px-3 py-2 text-slate-300 text-sm">
                <User className="w-4 h-4" />
                {username}
              </div>
              <button
                onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg mt-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;