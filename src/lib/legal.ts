// Legal documents (Terms / Privacy / DPA) — metadata + versions.
// The real legal text is pasted into LegalDocument.tsx when finalized by
// business/legal. Bump the version here when a document changes so the
// tenant DPA-acceptance record (future work) can re-prompt on updates.

export type LegalDocType = 'terms' | 'privacy' | 'dpa';

export const LEGAL_VERSIONS: Record<LegalDocType, string> = {
  terms: '0.1-draft',
  privacy: '0.1-draft',
  dpa: '0.1-draft',
};

export const LEGAL_DOCS: Record<LegalDocType, { title: string; titleEn: string }> = {
  terms: { title: 'เงื่อนไขการให้บริการ', titleEn: 'Terms of Service' },
  privacy: { title: 'นโยบายความเป็นส่วนตัว', titleEn: 'Privacy Policy' },
  dpa: { title: 'ข้อตกลงการประมวลผลข้อมูล', titleEn: 'Data Processing Agreement (DPA)' },
};
