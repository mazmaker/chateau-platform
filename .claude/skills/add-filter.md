# /add-filter — Add Search + Filter to List Page

## วัตถุประสงค์
เพิ่ม search bar + filter dropdown ให้หน้า list ที่ยังไม่มี ตามกฎ CLAUDE.md

## วิธีใช้
```
/add-filter src/pages/OwnerAudit.tsx
/add-filter src/pages/OwnerCompanies.tsx --filters="status,plan"
```

## สิ่งที่จะเพิ่ม

### Search Bar (บังคับ)
```tsx
const [searchQuery, setSearchQuery] = useState('');
// + <input> พร้อม Search icon (lucide-react)
// + filter logic: .toLowerCase().includes(q)
// + reset currentPage เมื่อ search เปลี่ยน
```

### Filter Dropdowns (ตามบริบท)
- status filter (ถ้ามี status field)
- plan filter (ถ้าเป็น tenant-related)
- date/period filter (เฉพาะเมื่อข้อมูลเปลี่ยนตาม period จริง)

### Pattern มาตรฐาน
```tsx
const filtered = rows.filter(r => {
  if (statusFilter !== 'all' && r.status !== statusFilter) return false;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    if (!r.name.toLowerCase().includes(q)) return false;
  }
  return true;
});
```

## ขั้นตอน
1. อ่านไฟล์ — เข้าใจ data structure และ fields ที่ควร searchable
2. เพิ่ม state variables
3. เพิ่ม filter UI (search input + dropdowns) เหนือตาราง
4. แก้ `filtered` / `paginated` array
5. typecheck
