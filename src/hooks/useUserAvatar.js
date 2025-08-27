import { useState, useEffect } from 'react';

export function useUserAvatar() {
  const [userAvatar, setUserAvatar] = useState('');
  const [userAvatarType, setUserAvatarType] = useState('default');

  useEffect(() => {
    let mounted = true;
    
    const loadAvatar = async () => {
      try {
        const avatarRes = await window.api.getSetting('user-avatar');
        const avatarTypeRes = await window.api.getSetting('user-avatar-type');
        
        if (mounted) {
          if (avatarRes && avatarRes.success && avatarRes.value) {
            setUserAvatar(avatarRes.value);
          }
          if (avatarTypeRes && avatarTypeRes.success && avatarTypeRes.value) {
            setUserAvatarType(avatarTypeRes.value);
          }
        }
      } catch (error) {
        console.error('Failed to load user avatar:', error);
      }
    };

    loadAvatar();
    
    return () => {
      mounted = false;
    };
  }, []);

  return { userAvatar, userAvatarType };
}
