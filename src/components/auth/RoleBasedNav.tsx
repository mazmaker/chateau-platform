import { ReactNode } from 'react';
import { useTenantPermission } from '@/hooks/useTenantData';

interface RoleBasedNavItem {
  label: string;
  href: string;
  icon: ReactNode;
  permission?: string;
  isLogout?: boolean;
}

interface RoleBasedNavProps {
  items: RoleBasedNavItem[];
  onItemClick: (item: RoleBasedNavItem) => void;
  activeItem?: string;
}

const RoleBasedNav = ({ items, onItemClick, activeItem }: RoleBasedNavProps) => {
  const filteredItems = items.filter(item => {
    // If no permission required, show to everyone
    if (!item.permission) return true;

    // Check if user has the required permission
    return useTenantPermission(item.permission);
  });

  return (
    <nav className="space-y-1">
      {filteredItems.map((item) => (
        <button
          key={item.label}
          onClick={() => onItemClick(item)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
            activeItem === item.href && !item.isLogout
              ? 'bg-chateau-50 text-chateau-600 border-l-4 border-chateau-600'
              : item.isLogout
              ? 'text-red-600 hover:bg-red-50'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          {item.icon}
          <span className="font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default RoleBasedNav;