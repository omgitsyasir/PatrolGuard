import { useCallback, useState } from 'react';
import { useToast } from './Toast.jsx';
import OfficerProfile from './settings/OfficerProfile.jsx';
import AppearanceSection from './settings/AppearanceSection.jsx';
import SitesManager from './settings/SitesManager.jsx';
import LlmProfilesManager from './settings/LlmProfilesManager.jsx';
import { api } from '../lib/api.js';

export default function Settings({ settings, onSettingsChange }) {
  const toast = useToast();

  const saveSettings = useCallback(
    async (next) => {
      try {
        const s = await api.put('/api/settings', { ...settings, ...next });
        onSettingsChange(s);
        toast('Settings saved', 'success');
        return true;
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    },
    [settings, onSettingsChange, toast]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <OfficerProfile settings={settings} onSave={saveSettings} />
        <AppearanceSection settings={settings} onSave={saveSettings} />
      </div>
      <SitesManager />
      <LlmProfilesManager />
    </div>
  );
}