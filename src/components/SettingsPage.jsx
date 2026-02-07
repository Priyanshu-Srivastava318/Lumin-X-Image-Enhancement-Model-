import React, { useState } from 'react';
import { User, Bell, Shield, Palette, Save } from 'lucide-react';
import { supabase } from '../supabase/config';

const SettingsPage = ({ user }) => {
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);

const handleSaveProfile = async () => {
  setSaving(true);
  try {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName }
    });
    if (error) throw error;
    alert('Profile updated successfully!');
  } catch (error) {
    console.error('Error updating profile:', error);
    alert('Failed to update profile');
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
          <p className="text-slate-400">Manage your account and application preferences</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              Profile Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  readOnly
                />
                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
              </div>

              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-400" />
              Preferences
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Processing Notifications</div>
                  <div className="text-sm text-slate-400">Get notified when image processing completes</div>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications ? 'bg-blue-600' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Auto-save Enhanced Images</div>
                  <div className="text-sm text-slate-400">Automatically save enhanced images to cloud</div>
                </div>
                <button
                  onClick={() => setAutoSave(!autoSave)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoSave ? 'bg-blue-600' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoSave ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-400" />
              Appearance
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-slate-700'
                      : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="text-white font-medium mb-1">Dark</div>
                  <div className="text-xs text-slate-400">Current theme</div>
                </button>
                
                <button
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    theme === 'light'
                      ? 'border-blue-500 bg-slate-700'
                      : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="text-white font-medium mb-1">Light</div>
                  <div className="text-xs text-slate-400">Coming soon</div>
                </button>
                
                <button
                  onClick={() => setTheme('auto')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    theme === 'auto'
                      ? 'border-blue-500 bg-slate-700'
                      : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="text-white font-medium mb-1">Auto</div>
                  <div className="text-xs text-slate-400">System default</div>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              Account
            </h3>
            
            <div className="space-y-3">
              <div className="text-sm text-slate-400">
                Account created: {user?.metadata?.creationTime || 'Unknown'}
              </div>
              <div className="text-sm text-slate-400">
                Last sign in: {user?.metadata?.lastSignInTime || 'Unknown'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
