import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';

interface CompanyLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const LOGO_UPDATE_EVENT = 'company-logo-updated';

export function notifyLogoUpdated() {
  window.dispatchEvent(new CustomEvent(LOGO_UPDATE_EVENT));
}

export function CompanyLogo({ className = '', size = 'md' }: CompanyLogoProps) {
  const [imageError, setImageError] = useState(false);
  const { currentTenant, loading, authChecked } = useSimpleAuth();

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

  const logoUrl = currentTenant?.logo_url_cached || null;
  const companyName = currentTenant?.company_name_cached || currentTenant?.name || null;
  // Tenant is "resolving" if auth hasn't finished OR currentTenant hasn't populated yet.
  // The latter catches the post-signIn race where user/role are set from cache but the
  // tenants Promise.all is still resolving in the background (AuthContextSimple.tsx:506).
  const tenantResolving = loading || !authChecked || !currentTenant;

  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  useEffect(() => {
    const handleLogoUpdate = () => setImageError(false);
    window.addEventListener(LOGO_UPDATE_EVENT, handleLogoUpdate);
    return () => window.removeEventListener(LOGO_UPDATE_EVENT, handleLogoUpdate);
  }, []);

  // Auth still resolving — render invisible placeholder of correct size to avoid flash-of-fallback
  if (tenantResolving && !logoUrl) {
    return <div className={`${sizeClasses[size]} ${className}`} aria-hidden="true" />;
  }

  if (!logoUrl || imageError) {
    return (
      <div className={`${sizeClasses[size]} ${className} gradient-primary rounded-xl flex items-center justify-center`}>
        <Building2 className={`${iconSizes[size]} text-primary-foreground`} />
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={companyName || 'Company Logo'}
      className={`${sizeClasses[size]} ${className} object-contain rounded-lg`}
      onError={() => setImageError(true)}
    />
  );
}
