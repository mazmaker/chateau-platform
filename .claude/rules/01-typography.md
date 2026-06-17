# Rule: Typography Standard Scale

## กฎหลัก
ห้ามใช้ arbitrary font size เช่น `text-[13px]`, `text-[15px]`, `text-[26px]` ในทุกหน้าทุกเมนู — ใช้เฉพาะ Tailwind standard scale เท่านั้น

## Scale มาตรฐาน

| ใช้กับ | Class | ขนาด |
|---|---|---|
| Page title (h1) | `text-2xl font-bold` | 24px |
| Section title (h2) | `text-base font-bold` | 16px |
| ข้อความปกติ | `text-sm` | 14px |
| Meta / helper / badge | `text-xs` | 12px |
| ตัวเลข KPI ใหญ่ | `text-2xl` หรือ `text-3xl` | 24–30px |

## Mapping แก้ arbitrary → standard
- `text-[10px]`, `text-[11px]` → `text-xs` (ยกเว้น chart axis/badge เท่านั้น)
- `text-[12px]` → `text-xs`
- `text-[13px]`, `text-[14px]`, `text-[15px]` → `text-sm`
- `text-[16px]` → `text-base`
- `text-[18px]` → `text-lg`
- `text-[20px]`, `text-[22px]` → `text-xl`
- `text-[24px]`, `text-[26px]` → `text-2xl`
- `text-[28px]`, `text-[30px]` → `text-3xl`

## ข้อยกเว้น
chart axis label / bar badge ที่ space จำกัดมาก ใช้ `text-[10px]`/`text-[11px]` ได้ (เฉพาะใน chart components เท่านั้น)

## เมื่อต้องแก้
เวลาทำหน้าใหม่หรือแก้หน้าเก่า ให้ grep หา `text-\[\d+px\]` และแก้ทันที ไม่รอให้ผู้ใช้บอก
