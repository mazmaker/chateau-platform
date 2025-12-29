import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Settings as SettingsIcon,
  Users,
  Building2,
  Home,
  FileText,
  Lock,
  Loader2
} from 'lucide-react';
import {
  WriteGuard,
  DeleteGuard,
  ManageSettingsGuard,
  ManageUsersGuard,
  usePermissions
} from '@/components/auth/PermissionGuard';

interface DashboardControlsProps {
  title: string;
  description?: string;
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  showActions?: boolean;
  children?: React.ReactNode;
}

export const DashboardControls: React.FC<DashboardControlsProps> = ({
  title,
  description,
  onAdd,
  onEdit,
  onDelete,
  onExport,
  onImport,
  showActions = true,
  children
}) => {
  const { canWrite, canDelete, canManageSettings } = usePermissions();

  return (
    <div className="space-y-6">
      {/* Header with Role-specific controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>

        {showActions && (
          <div className="flex flex-wrap gap-2">
            <WriteGuard fallback={
              <div className="text-sm text-muted-foreground italic">
                <Lock className="w-4 h-4 inline mr-1" />
                อ่านอย่างเดียว
              </div>
            }>
              {onAdd && (
                <Button onClick={onAdd} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่ม
                </Button>
              )}
              {onEdit && (
                <Button onClick={onEdit} variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  แก้ไข
                </Button>
              )}
              {onImport && (
                <Button onClick={onImport} variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  นำเข้า
                </Button>
              )}
              {onExport && (
                <Button onClick={onExport} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  ส่งออก
                </Button>
              )}
            </WriteGuard>

            <DeleteGuard>
              {onDelete && (
                <Button onClick={onDelete} variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบ
                </Button>
              )}
            </DeleteGuard>

            <ManageSettingsGuard>
              <Button variant="outline" size="sm">
                <SettingsIcon className="w-4 h-4 mr-2" />
                แก้ไขโปรไฟล์
              </Button>
            </ManageSettingsGuard>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {children}
      </div>

      </div>
  );
};

// Quick Actions for different roles
interface QuickActionsProps {
  isDataReady?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ isDataReady = true }) => {
  const { isOwner, isAdmin, isSales } = usePermissions();

  const ownerActions = [
    { icon: Users, label: 'จัดการผู้ใช้', href: '/users', color: 'text-blue-600' },
    { icon: Building2, label: 'แก้ไขโปรไฟล์', href: '/settings', color: 'text-green-600' },
    { icon: FileText, label: 'รายงาน', href: '/reports', color: 'text-purple-600' },
  ];

  const adminActions = [
    { icon: Users, label: 'จัดการทีม', href: '/team', color: 'text-blue-600' },
    { icon: FileText, label: 'รายงาน', href: '/reports', color: 'text-purple-600' },
  ];

  const salesActions = [
    { icon: Building2, label: 'เพิ่มโครงการ', href: '/projects/new', color: 'text-green-600' },
    { icon: Users, label: 'เพิ่มลูกค้า', href: '/customers/new', color: 'text-blue-600' },
    { icon: Home, label: 'จัดการยูนิต', href: '/units', color: 'text-orange-600' },
  ];

  const actions = isOwner ? ownerActions : isAdmin ? adminActions : isSales ? salesActions : [];

  if (actions.length === 0) return null;

  return (
    <Card className={isDataReady ? '' : 'opacity-60 pointer-events-none'}>
      <CardHeader>
        <CardTitle className="text-lg">การกระทำด่วน</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto p-4 flex-col gap-2"
              onClick={() => isDataReady && (window.location.href = action.href)}
              disabled={!isDataReady}
            >
              <action.icon className={`w-6 h-6 ${action.color}`} />
              <span className="text-sm">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Data Protection Notice
interface DataProtectionNoticeProps {
  isDataReady?: boolean;
}

export const DataProtectionNotice: React.FC<DataProtectionNoticeProps> = ({ isDataReady = true }) => {
  const { isOwner, isAdmin, isSales } = usePermissions();

  // Don't show until data is ready to prevent showing incorrect/empty state
  if (!isDataReady) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Lock className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-sm text-blue-800 flex items-center gap-2">
          <span className="font-medium">ความปลอดภัยข้อมูล:</span>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>กำลังตรวจสอบสิทธิ์...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <Lock className="w-5 h-5 text-blue-600 flex-shrink-0" />
      <div className="text-sm text-blue-800">
        <span className="font-medium">ความปลอดภัยข้อมูล:</span>
        <span className="ml-1">
          {isSales && 'คุณสามารถดูและแก้ไขข้อมูลได้'}
          {isAdmin && 'คุณมีสิทธิ์จัดการข้อมูลทั้งหมด'}
          {isOwner && 'คุณมีสิทธิ์ควบคุมระบบทั้งหมด'}
        </span>
      </div>
    </div>
  );
};

export default DashboardControls;