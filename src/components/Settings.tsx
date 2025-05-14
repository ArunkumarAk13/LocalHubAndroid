import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { usersAPI } from '@/api';
import { useAuth } from '@/contexts/AuthContext';

interface SettingsProps {
  onClose: () => void;
  open: boolean;
}

const Settings: React.FC<SettingsProps> = ({ onClose, open }) => {
  const { user, isAuthenticated } = useAuth();
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load settings when component opens
  useEffect(() => {
    const loadSettings = async () => {
      if (!isAuthenticated || !user) {
        toast.error('Please log in to access settings');
        return;
      }

      try {
        const response = await usersAPI.getUserSettings();
        if (response.success) {
          setWhatsappEnabled(response.settings.whatsappEnabled);
        }
      } catch (error: any) {
        console.error('Error loading settings:', error);
        // If it's a 400 error, it means settings don't exist yet - create them
        if (error.response?.status === 400) {
          try {
            const createResponse = await usersAPI.updateUserSettings({
              whatsappEnabled: false
            });
            if (createResponse.success) {
              setWhatsappEnabled(false);
            }
          } catch (createError) {
            console.error('Error creating settings:', createError);
            toast.error('Failed to initialize settings');
          }
        } else {
          toast.error('Failed to load settings');
        }
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadSettings();
    }
  }, [open, isAuthenticated, user]);

  // Handle toggle change
  const handleToggleChange = async (checked: boolean) => {
    if (!isAuthenticated || !user) {
      toast.error('Please log in to change settings');
      return;
    }

    try {
      const response = await usersAPI.updateUserSettings({
        whatsappEnabled: checked
      });
      
      if (response.success) {
        setWhatsappEnabled(checked);
        toast.success(checked ? 'WhatsApp chat enabled' : 'WhatsApp chat disabled');
      } else {
        throw new Error(response.message || 'Failed to update settings');
      }
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast.error(error.response?.data?.message || 'Failed to update settings');
      // Revert the toggle if the update failed
      setWhatsappEnabled(!checked);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Please log in to access settings</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <MessageCircle size={20} /> Communication
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="whatsappEnabled">WhatsApp Chat</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Allow other users to contact you via WhatsApp
              </p>
            </div>
            <Switch
              id="whatsappEnabled"
              checked={whatsappEnabled}
              onCheckedChange={handleToggleChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 