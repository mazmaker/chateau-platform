import { useState } from 'react';
import { Building2, ChevronDown, Check, Plus, Settings } from 'lucide-react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { cn } from '@/lib/utils';

const TenantSwitcher = () => {
  const { currentTenant, userTenants, switchTenant } = useSimpleAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleTenantSwitch = async (tenantId: string) => {
    await switchTenant(tenantId);
    setIsOpen(false);
  };

  if (!currentTenant) {
    return null;
  }

  return (
    <div className="relative">
      {/* Current Tenant Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Building2 className="w-4 h-4 text-gray-600" />
        <span className="font-medium text-gray-900 truncate max-w-32">
          {currentTenant.name}
        </span>
        <ChevronDown className={cn(
          "w-4 h-4 text-gray-600 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Switch Organization</h3>
              <p className="text-sm text-gray-500 mt-1">
                Select a different organization to work with
              </p>
            </div>

            {/* Tenant List */}
            <div className="max-h-64 overflow-y-auto">
              {userTenants.map((userTenant: any) => (
                <button
                  key={userTenant.tenant_id}
                  onClick={() => handleTenantSwitch(userTenant.tenant_id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
                    "border-b border-gray-100 last:border-b-0"
                  )}
                >
                  <div className="w-8 h-8 bg-gray-900 text-white shadow-lg rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {userTenant.tenants.name.charAt(0)}
                  </div>

                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {userTenant.tenants.name}
                      </p>
                      {userTenant.tenant_id === currentTenant.id && (
                        <Check className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 capitalize">
                      {userTenant.role} • {userTenant.tenants.plan || 'Free'} Plan
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 space-y-2">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Create New Organization
              </button>

              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
                Manage Organizations
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TenantSwitcher;