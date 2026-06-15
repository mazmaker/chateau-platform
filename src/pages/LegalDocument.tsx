import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { LEGAL_DOCS, LEGAL_VERSIONS, type LegalDocType } from '@/lib/legal';

// Public placeholder page for a legal document (Terms / Privacy / DPA).
// Structure is ready now; paste the finalized legal text into `sections`
// (and bump the version in src/lib/legal.ts) once business/legal delivers it.
const LegalDocument = ({ doc }: { doc: LegalDocType }) => {
  const navigate = useNavigate();
  const meta = LEGAL_DOCS[doc];
  const version = LEGAL_VERSIONS[doc];

  // DPA gets an extra hint line — it's the controller↔processor agreement (PDPA).
  const note = doc === 'dpa'
    ? 'ข้อตกลงนี้กำหนดบทบาทผู้ควบคุมข้อมูล (บริษัทผู้พัฒนา) และผู้ประมวลผลข้อมูล (CHATEAU) ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล'
    : 'เอกสารฉบับสมบูรณ์อยู่ระหว่างจัดทำโดยฝ่ายกฎหมาย';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
        </button>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-gray-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{meta.title}</h1>
              <p className="text-xs text-gray-400 mt-0.5">{meta.titleEn} · เวอร์ชัน {version}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            📄 {note}
          </div>

          <div className="mt-6 space-y-3 text-sm leading-relaxed text-gray-600">
            <p>เนื้อหา “{meta.title}” ฉบับจริงจะแสดงที่นี่เมื่อเอกสารพร้อม</p>
            <div className="space-y-2 pt-2 text-gray-300">
              <div className="h-3 w-3/4 rounded bg-gray-100" />
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-5/6 rounded bg-gray-100" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-8 pt-6 border-t border-gray-100">
            อัปเดตล่าสุด: — · CHATEAU Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalDocument;
