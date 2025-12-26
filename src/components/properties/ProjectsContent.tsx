import { useState, useEffect } from "react";
import { Search, Plus, Filter, MoreHorizontal, Building2, MapPin, Home, Edit, Trash2, Eye, Calendar, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { PropertyType } from "@/lib/database-types";
import CreateProjectModal from "./CreateProjectModal";
import EditProjectModal from "./EditProjectModal";

interface Project {
  id: string;
  name: string;
  code?: string;
  description?: string;
  property_type: PropertyType;
  address: any;
  latitude?: number;
  longitude?: number;
  developer?: string;
  completion_date?: string;
  building_count?: number;
  total_units?: number;
  total_area_sqm?: number;
  price_min?: number;
  price_max?: number;
  price_avg_per_sqm?: number;
  images: any[];
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  view_count: number;
  favorite_count: number;
  inquiry_count: number;
}

const ProjectsContent = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { currentTenant, supabase } = useAuth();

  useEffect(() => {
    fetchProjects();
  }, [currentTenant]);

  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, typeFilter, statusFilter]);

  const fetchProjects = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    let filtered = projects;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.developer?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(project => project.property_type === typeFilter);
    }

    // Status filter
    if (statusFilter === "active") {
      filtered = filtered.filter(project => project.is_active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(project => !project.is_active);
    }

    setFilteredProjects(filtered);
  };

  const toggleProjectStatus = async (projectId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: !currentStatus })
        .eq('id', projectId);

      if (error) throw error;

      // Update local state
      setProjects(prev => prev.map(project =>
        project.id === projectId ? { ...project, is_active: !currentStatus } : project
      ));
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบโครงการนี้?")) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      // Update local state
      setProjects(prev => prev.filter(project => project.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const getPropertyTypeLabel = (type: PropertyType) => {
    const labels = {
      [PropertyType.APARTMENT]: "คอนโด",
      [PropertyType.HOUSE]: "บ้านเดี่ยว",
      [PropertyType.VILLA]: "วิลล่า",
      [PropertyType.CONDO]: "คอนโดมิเนียม",
      [PropertyType.COMMERCIAL]: "พาณิชย์",
      [PropertyType.TOWNHOUSE]: "ทาวน์เฮาส์"
    };
    return labels[type] || type;
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "-";
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการโครงการ</h1>
          <p className="text-gray-600 mt-1">จัดการข้อมูลโครงการอสังหาริมทรัพย์</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          เพิ่มโครงการใหม่
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">ทั้งหมด</p>
                <p className="text-xl font-semibold">{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Home className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">ใช้งานอยู่</p>
                <p className="text-xl font-semibold">{projects.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">ยูนิตทั้งหมด</p>
                <p className="text-xl font-semibold">
                  {projects.reduce((sum, p) => sum + (p.total_units || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">ราคาเฉลี่ย</p>
                <p className="text-xl font-semibold">
                  {projects.length > 0 ? formatCurrency(
                    projects.reduce((sum, p) => sum + (p.price_avg_per_sqm || 0), 0) / projects.length
                  ) : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="ค้นหาตามชื่อ รหัส หรือผู้พัฒนา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">ทุกประเภท</option>
              <option value={PropertyType.APARTMENT}>คอนโด</option>
              <option value={PropertyType.HOUSE}>บ้านเดี่ยว</option>
              <option value={PropertyType.VILLA}>วิลล่า</option>
              <option value={PropertyType.CONDO}>คอนโดมิเนียม</option>
              <option value={PropertyType.COMMERCIAL}>พาณิชย์</option>
              <option value={PropertyType.TOWNHOUSE}>ทาวน์เฮาส์</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="active">ใช้งานอยู่</option>
              <option value="inactive">ระงับ</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            {/* Project Image */}
            <div className="h-48 bg-gray-200 relative">
              {project.images && project.images.length > 0 ? (
                <img
                  src={project.images[0]?.url}
                  alt={project.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building2 className="w-12 h-12 text-gray-400" />
                </div>
              )}
              {project.is_featured && (
                <Badge className="absolute top-2 right-2 bg-yellow-100 text-yellow-800">
                  แนะนำ
                </Badge>
              )}
            </div>

            {/* Project Info */}
            <CardContent className="pt-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{project.name}</h3>
                  {project.code && (
                    <p className="text-sm text-gray-600">รหัส: {project.code}</p>
                  )}
                </div>
                <Badge className={project.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {project.is_active ? "ใช้งานอยู่" : "ระงับ"}
                </Badge>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {project.description || "-"}
              </p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Home className="w-4 h-4 text-gray-400" />
                  <span>{getPropertyTypeLabel(project.property_type)}</span>
                </div>
                {project.developer && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{project.developer}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="line-clamp-1">
                    {project.address?.district || "-"} {project.address?.province || ""}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm mb-4">
                <div>
                  <p className="text-gray-600">ยูนิตทั้งหมด</p>
                  <p className="font-semibold">{project.total_units || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600">ราคาเฉลี่ย/ตร.ม.</p>
                  <p className="font-semibold">{formatCurrency(project.price_avg_per_sqm)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleProjectStatus(project.id, project.is_active)}
                  className="flex-1"
                >
                  <Eye className="w-4 h-4" />
                  {project.is_active ? "ระงับ" : "เปิด"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedProject(project);
                    setShowEditModal(true);
                  }}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4" />
                  แก้ไข
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteProject(project.id)}
                  className="flex-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบ
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">ไม่พบโครงการที่ตรงกับเงื่อนไข</p>
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onProjectCreated={fetchProjects}
      />

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        project={selectedProject}
        onProjectUpdated={fetchProjects}
      />
    </div>
  );
};

export default ProjectsContent;