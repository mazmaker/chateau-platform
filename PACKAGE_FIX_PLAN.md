# แผนแก้ไขระบบจัดการแพ็กเกจ

## ปัญหาปัจจุบัน
1. `packageConfig` เป็น local state ใน TenantManagement.tsx
2. ไม่ได้เก็บลงฐานข้อมูล - เมื่อรีเฟรชหายไป
3. ไฟล์อื่นๆ ยัง hardcode ราคาอยู่

## วิธีแก้ไข

### Option 1: เพิ่ม table subscription_packages
```sql
-- สร้างตารางเก็บข้อมูลแพ็กเกจ
CREATE TABLE subscription_packages (
    id text PRIMARY KEY,
    name text NOT NULL,
    price decimal(10,2) NOT NULL,
    properties integer NOT NULL,
    users integer NOT NULL,
    features jsonb DEFAULT '[]',
    created_at timestamptz DEFAULT NOW()
);
```

### Option 2: เก็บใน company_settings 
```sql
-- ใช้ table company_settings ที่มีอยู่แล้ว
INSERT INTO company_settings (key, value, type)
VALUES ('subscription_packages', '[{...}]', 'json');
```

## แนวทางที่แนะนำ: Option 2

### ขั้นตอนการแก้ไข

#### 1. แก้ไข TenantManagement.tsx
```typescript
// เพิ่มฟังก์ชั่นบันทึกลงฐานข้อมูล
const savePackageConfig = async (newPackages: PackageConfig[]) => {
  try {
    await supabase
      .from('company_settings')
      .upsert({
        key: 'subscription_packages',
        value: JSON.stringify(newPackages),
        type: 'json'
      });
    
    setPackageConfig(newPackages);
    toast.success('บันทึกการตั้งค่าแพ็กเกจแล้ว');
  } catch (error) {
    toast.error('ไม่สามารถบันทึกได้');
  }
};
```

#### 2. สร้าง utility function
```typescript
// src/lib/package-utils.ts
export const getPackagePrice = async (planKey: string): Promise<number> => {
  const { data } = await supabase
    .from('company_settings')
    .select('value')
    .eq('key', 'subscription_packages')
    .single();

  if (data?.value) {
    const packages = JSON.parse(data.value);
    const pkg = packages.find(p => p.id === planKey);
    return pkg ? parseFloat(pkg.price.replace(',', '')) : 0;
  }

  // Fallback ราคา
  const fallbackPrices = {
    'free': 0,
    'starter': 2900,
    'professional': 5900,
    'enterprise': 15900
  };
  
  return fallbackPrices[planKey] || 0;
};
```

#### 3. แก้ไขไฟล์อื่นๆ
```typescript
// invoice-pdf.ts, receipt-pdf.ts และไฟล์อื่นๆ
import { getPackagePrice, getPackageName } from '@/lib/package-utils';

private async getPlanName(plan: string): Promise<string> {
  const price = await getPackagePrice(plan);
  const name = await getPackageName(plan);
  return `${name} - ฿${price.toLocaleString()}/เดือน`;
}
```

## ประโยชน์
- ✅ แอดมินแก้ไขราคาได้จริง
- ✅ ข้อมูลไม่หายเมื่อรีเฟรช  
- ✅ ระบบอื่นใช้ราคาล่าสุดได้
- ✅ ไม่ต้องสร้าง table ใหม่

## การทดสอบ
1. เข้า /tenants แก้ไขราคาแพ็กเกจ
2. ตรวจสอบว่าบันทึกลงฐานข้อมูล
3. สร้างใบแจ้งหนี้ดูราคาอัพเดตหรือไม่
4. รีเฟรชหน้าดูข้อมูลยังอยู่หรือไม่