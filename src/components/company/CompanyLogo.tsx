import { useState, useEffect, useRef } from 'react';
import { Building2 } from 'lucide-react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';

interface CompanyLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

// Event name for logo update notification
const LOGO_UPDATE_EVENT = 'company-logo-updated';

export function notifyLogoUpdated() {
  window.dispatchEvent(new CustomEvent(LOGO_UPDATE_EVENT));
}

export function CompanyLogo({ className = '', size = 'md' }: CompanyLogoProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { currentTenant } = useSimpleAuth();

  // Track tenant ID to avoid unnecessary reloads
  const tenantIdRef = useRef<string | null>(null);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
    '2xl': 'w-8 h-8'
  };

  // Get logo URL from cached tenant data (fast! - no API call needed)
  const logoUrl = currentTenant?.logo_url_cached || null;
  const companyName = currentTenant?.company_name_cached || currentTenant?.name || null;

  useEffect(() => {
    // Only reset if tenant actually changed
    if (currentTenant?.id && tenantIdRef.current !== currentTenant.id) {
      tenantIdRef.current = currentTenant.id;
      setImageLoaded(false);
      setImageError(false);
    }

    // Listen for logo update events
    const handleLogoUpdate = () => {
      setImageLoaded(false);
      setImageError(false);
    };

    window.addEventListener(LOGO_UPDATE_EVENT, handleLogoUpdate);

    return () => {
      window.removeEventListener(LOGO_UPDATE_EVENT, handleLogoUpdate);
    };
  }, [currentTenant?.id]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Show fallback if: no logo, image error, or image not loaded yet
  if (!logoUrl || imageError || !imageLoaded) {
    return (
      <>
        {/* Show fallback */}
        <div className={`${sizeClasses[size]} ${className} gradient-primary rounded-xl flex items-center justify-center`}>
          <Building2 className={`${iconSizes[size]} text-primary-foreground`} />
        </div>
        {/* Preload image in background - hidden until loaded */}
        {logoUrl && !imageError && !imageLoaded && (
          <img
            src={logoUrl}
            alt=""
            className="hidden"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </>
    );
  }

  // Show logo image only when fully loaded
  return (
    <img
      src={logoUrl}
      alt={companyName || 'Company Logo'}
      className={`${sizeClasses[size]} ${className} object-contain rounded-lg`}
    />
  );
}
