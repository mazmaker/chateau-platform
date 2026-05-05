import React, { useState, useEffect } from 'react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubscriptionGuard, useSubscriptionFeatures } from '@/hooks/useSubscriptionFeatures';
import {
  Key,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Activity,
  AlertTriangle,
  ExternalLink,
  Code,
  BookOpen,
  Shield,
  Clock,
  BarChart3,
  RefreshCw
} from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  permissions: string[];
  last_used_at?: string;
  usage_count: number;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
}

interface ApiUsage {
  date: string;
  requests: number;
  success_rate: number;
  avg_response_time: number;
}

const ApiManagement: React.FC = () => {
  const { currentTenant } = useSimpleAuth();
  const { hasApiAccess, currentPlan, planLabel } = useSubscriptionFeatures();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['read']);
  const [visibleKeys, setVisibleKeys] = useState<{ [key: string]: boolean }>({});
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<ApiUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  const availablePermissions = [
    { id: 'read', label: 'อ่านข้อมูล (Read)', description: 'เข้าถึงข้อมูลแคมเปญและลีด' },
    { id: 'write', label: 'เขียนข้อมูล (Write)', description: 'สร้างและแก้ไขแคมเปญ' },
    { id: 'delete', label: 'ลบข้อมูล (Delete)', description: 'ลบแคมเปญและลีด' },
    { id: 'admin', label: 'ผู้ดูแลระบบ (Admin)', description: 'เข้าถึงการตั้งค่าระดับสูง' }
  ];

  const rateLimits = {
    starter: { requests: 100, period: 'ต่อนาที' },
    professional: { requests: 500, period: 'ต่อนาที' },
    enterprise: { requests: 1000, period: 'ต่อนาที' }
  };

  useEffect(() => {
    if (hasApiAccess && currentTenant) {
      fetchApiKeys();
      fetchUsageData();
    }
  }, [currentTenant, hasApiAccess]);

  const fetchApiKeys = async () => {
    if (!currentTenant) return;

    try {
      setLoading(true);
      // Simulated API keys data - in real implementation, this would come from your API keys table
      const mockApiKeys: ApiKey[] = [
        {
          id: '1',
          name: 'Production API',
          key_prefix: 'ck_live_',
          key_hash: 'hashed_key_1',
          permissions: ['read', 'write'],
          last_used_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          usage_count: 1247,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true
        },
        {
          id: '2',
          name: 'Development API',
          key_prefix: 'ck_test_',
          key_hash: 'hashed_key_2',
          permissions: ['read'],
          last_used_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          usage_count: 156,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true
        }
      ];

      setApiKeys(mockApiKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageData = async () => {
    if (!currentTenant) return;

    try {
      setUsageLoading(true);
      // Simulated usage data
      const mockUsageData: ApiUsage[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        mockUsageData.push({
          date: date.toISOString().split('T')[0],
          requests: Math.floor(Math.random() * 200) + 50,
          success_rate: 95 + Math.random() * 5,
          avg_response_time: 120 + Math.random() * 80
        });
      }
      setUsageData(mockUsageData);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setUsageLoading(false);
    }
  };

  const generateApiKey = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'ck_live_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const newKey = generateApiKey();
      const apiKey: ApiKey = {
        id: Date.now().toString(),
        name: newKeyName,
        key_prefix: newKey.substring(0, 8),
        key_hash: 'hashed_' + newKey,
        permissions: selectedPermissions,
        usage_count: 0,
        created_at: new Date().toISOString(),
        is_active: true
      };

      setApiKeys([...apiKeys, apiKey]);
      setGeneratedKey(newKey);
      setNewKeyName('');
      setSelectedPermissions(['read']);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating API key:', error);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบ API Key นี้? การกระทำนี้ไม่สามารถยกเลิกได้')) {
      setApiKeys(apiKeys.filter(key => key.id !== keyId));
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    // You could add a toast notification here
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPermissionBadgeColor = (permission: string) => {
    const colors = {
      read: 'bg-green-100 text-green-800',
      write: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      admin: 'bg-purple-100 text-purple-800'
    };
    return colors[permission] || 'bg-gray-100 text-gray-800';
  };

  const currentLimit = rateLimits[currentPlan] || rateLimits.professional;

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-chateau" />
          <span className="ml-3 text-lg">กำลังโหลดข้อมูล API...</span>
        </div>
      </div>
    );
  }

  return (
    <SubscriptionGuard feature="api_access" showUpgradePrompt={true}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">การจัดการ API</h1>
            <p className="text-gray-600 mt-1">จัดการ API Keys และติดตามการใช้งาน</p>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-chateau text-white">
              แผน {planLabel} - {currentLimit.requests} คำขอ{currentLimit.period}
            </Badge>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-chateau hover:bg-chateau-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              สร้าง API Key ใหม่
            </Button>
          </div>
        </div>

        {/* Generated Key Modal */}
        {generatedKey && (
          <Card className="p-6 border-2 border-green-200 bg-green-50">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-green-100 rounded-full">
                <Key className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-2">API Key สร้างสำเร็จ!</h3>
                <p className="text-sm text-green-800 mb-3">
                  กรุณาคัดลอกและเก็บ API Key นี้ไว้ในที่ปลอดภัย เราจะไม่แสดง Key นี้อีกครั้ง
                </p>
                <div className="flex items-center gap-2 p-3 bg-white border rounded-lg">
                  <code className="flex-1 text-sm font-mono break-all">{generatedKey}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyKey(generatedKey)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setGeneratedKey(null)}
              >
                ✕
              </Button>
            </div>
          </Card>
        )}

        {/* Create API Key Form */}
        {showCreateForm && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">สร้าง API Key ใหม่</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">ชื่อ API Key</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="เช่น Production API, Development API"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-chateau focus:border-chateau-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">สิทธิ์การเข้าถึง</label>
                <div className="grid grid-cols-2 gap-3">
                  {availablePermissions.map((perm) => (
                    <label key={perm.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions([...selectedPermissions, perm.id]);
                          } else {
                            setSelectedPermissions(selectedPermissions.filter(p => p !== perm.id));
                          }
                        }}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-sm">{perm.label}</div>
                        <div className="text-xs text-gray-600">{perm.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Button onClick={handleCreateApiKey} className="bg-chateau hover:bg-chateau-600">
                  <Key className="w-4 h-4 mr-2" />
                  สร้าง API Key
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  ยกเลิก
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* API Keys List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">API Keys ที่มีอยู่</h3>
            <Badge variant="outline">{apiKeys.length} keys</Badge>
          </div>

          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">ยังไม่มี API Keys</p>
              <p className="text-sm text-gray-500">สร้าง API Key แรกเพื่อเริ่มใช้งาน API</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{apiKey.name}</h4>
                        {apiKey.is_active ? (
                          <Badge className="bg-green-100 text-green-800">ใช้งานได้</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-100 text-red-800">ถูกระงับ</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {visibleKeys[apiKey.id]
                            ? `${apiKey.key_prefix}${'*'.repeat(24)}`
                            : `${apiKey.key_prefix}${'•'.repeat(24)}`
                          }
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                        >
                          {visibleKeys[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm text-gray-600">สิทธิ์:</span>
                        {apiKey.permissions.map((perm) => (
                          <Badge key={perm} className={getPermissionBadgeColor(perm)}>
                            {availablePermissions.find(p => p.id === perm)?.label.split(' ')[0]}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>สร้างเมื่อ: {formatDate(apiKey.created_at)}</span>
                        {apiKey.last_used_at && (
                          <span>ใช้ครั้งล่าสุด: {formatDate(apiKey.last_used_at)}</span>
                        )}
                        <span>ใช้งาน: {apiKey.usage_count.toLocaleString()} ครั้ง</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyKey(`${apiKey.key_prefix}${'x'.repeat(24)}`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Usage Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">การใช้งาน API วันนี้</h3>
              <Activity className="w-5 h-5 text-chateau" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">คำขอทั้งหมด</span>
                  <span className="font-semibold">1,247</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div className="bg-chateau h-2 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">อัตราความสำเร็จ</span>
                <span className="font-semibold text-green-600">98.7%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">เวลาตอบสนองเฉลี่ย</span>
                <span className="font-semibold">142ms</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">ข้อจำกัดอัตรา</h3>
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">ขีดจำกัดปัจจุบัน</span>
                <span className="font-semibold">{currentLimit.requests} คำขอ{currentLimit.period}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">ใช้งานแล้ว</span>
                <span className="font-semibold">1,247 / {currentLimit.requests * 60}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '8.7%' }}></div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">เอกสารประกอบ</h3>
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Code className="w-4 h-4 mr-2" />
                API Reference
                <ExternalLink className="w-3 h-3 ml-auto" />
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <BookOpen className="w-4 h-4 mr-2" />
                คู่มือเริ่มต้น
                <ExternalLink className="w-3 h-3 ml-auto" />
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                ตัวอย่างโค้ด
                <ExternalLink className="w-3 h-3 ml-auto" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Security Notice */}
        <Card className="p-6 bg-chateau-50 border-chateau-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-chateau mt-0.5" />
            <div>
              <h4 className="font-semibold text-chateau-800 mb-2">ข้อควรระวังด้านความปลอดภัย</h4>
              <ul className="text-sm text-chateau-700 space-y-1">
                <li>• เก็บ API Keys ในที่ปลอดภัยและอย่าแชร์กับผู้อื่น</li>
                <li>• ใช้สิทธิ์ขั้นต่ำที่จำเป็นสำหรับแต่ละ API Key</li>
                <li>• ตรวจสอบการใช้งานเป็นประจำและลบ Keys ที่ไม่ใช้แล้ว</li>
                <li>• อย่าใส่ API Keys ในโค้ดที่เก็บใน public repositories</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </SubscriptionGuard>
  );
};

export default ApiManagement;