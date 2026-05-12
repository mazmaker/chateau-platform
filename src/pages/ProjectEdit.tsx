import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import CreateProjectModal from '@/components/properties/CreateProjectModal';

const ProjectEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollSection = searchParams.get('section') as 'location' | null;

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        toast.error('ไม่พบโครงการ');
        navigate('/properties');
        return;
      }
      setProject(data);
    } catch (err) {
      console.error(err);
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-chateau" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 max-w-5xl mx-auto space-y-4">
          <Button variant="outline" onClick={() => navigate('/properties')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> กลับไปรายการโครงการ
          </Button>

          {project && (
            <CreateProjectModal
              isOpen={true}
              editingProject={project}
              pageMode
              scrollToSection={scrollSection}
              onClose={() => navigate('/properties')}
              onProjectCreated={() => navigate('/properties')}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default ProjectEdit;
