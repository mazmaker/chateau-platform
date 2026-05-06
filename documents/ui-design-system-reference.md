# UI Design System Reference — ถอดแบบจาก Kids Kingdom Platform
# นำมาปรับใช้กับ CHATEAU Platform

**ต้นแบบ:** github.com/mazdsi/kids-kingdom-platform  
**วันที่ถอดแบบ:** 5 พฤษภาคม 2569

---

## สิ่งที่เหมือนกัน (ใช้ได้ทันที)

| รายการ | Kids Kingdom | CHATEAU | สถานะ |
|--------|-------------|---------|-------|
| Font | Noto Sans Thai | Noto Sans Thai | ✅ เหมือนกัน |
| CSS Framework | Tailwind CSS v4 | Tailwind CSS v4 | ✅ เหมือนกัน |
| Component Library | shadcn/ui | shadcn/ui | ✅ เหมือนกัน |
| Icon Library | lucide-react | lucide-react | ✅ เหมือนกัน |
| Chart Library | recharts | recharts | ✅ เหมือนกัน |
| Color Space | OKLCH | HEX → ต้องแปลง | ⚠️ ต้องปรับ |
| Primary Color | Red `#E60023` | Gold `#ca8a04` | 🔄 เปลี่ยนสี |

---

## 1. Color System (ปรับสีให้เป็น CHATEAU)

### หลักการ: เปลี่ยนจาก Red → Gold/Luxury

Kids Kingdom ใช้ Red เป็น primary  
CHATEAU ใช้ Gold เป็น primary → เปลี่ยนค่า OKLCH เท่านั้น โครงสร้างเหมือนกันทุกอย่าง

### CSS Variables สำหรับ CHATEAU (ปรับจาก Kids Kingdom)

```css
/* src/index.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

@theme inline {
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);

  --font-sans: var(--font-noto-thai);
  --font-display: var(--font-noto-thai);
  --font-mono: var(--font-noto-thai);
  --font-heading: var(--font-noto-thai);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-primary: var(--sidebar-primary);
}

:root {
  /* === CHATEAU Luxury Design System === */
  --radius: 0.75rem;

  /* Background & Surface */
  --background: oklch(0.99 0 0);
  --foreground: oklch(0.16 0.01 60);       /* warm dark */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.16 0.01 60);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.16 0.01 60);

  /* Primary = Gold */
  --primary: oklch(0.62 0.15 80);          /* #ca8a04 → OKLCH */
  --primary-foreground: oklch(0.99 0 0);

  /* Secondary = Warm Gray */
  --secondary: oklch(0.97 0.005 80);
  --secondary-foreground: oklch(0.25 0.01 60);

  /* Muted */
  --muted: oklch(0.97 0.003 80);
  --muted-foreground: oklch(0.50 0.01 60);

  /* Accent = Warm Brown */
  --accent: oklch(0.55 0.10 60);           /* #8b5a2b */
  --accent-foreground: oklch(0.99 0 0);

  /* Destructive */
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.99 0 0);

  /* Border & Input */
  --border: oklch(0.92 0.005 80);
  --input: oklch(0.92 0.005 80);
  --ring: oklch(0.62 0.15 80);             /* same as primary */

  /* Charts */
  --chart-1: oklch(0.62 0.15 80);          /* gold */
  --chart-2: oklch(0.55 0.10 60);          /* brown */
  --chart-3: oklch(0.55 0.18 240);         /* blue */
  --chart-4: oklch(0.60 0.18 145);         /* green */
  --chart-5: oklch(0.577 0.245 27);        /* red */

  /* Sidebar */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.16 0.01 60);
  --sidebar-primary: oklch(0.62 0.15 80);
  --sidebar-primary-foreground: oklch(0.99 0 0);
  --sidebar-accent: oklch(0.97 0.005 80);
  --sidebar-accent-foreground: oklch(0.25 0.01 60);
  --sidebar-border: oklch(0.92 0.005 80);
  --sidebar-ring: oklch(0.62 0.15 80);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.72 0.15 80);          /* lighter gold in dark */
  --primary-foreground: oklch(0.145 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0.03 60);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.72 0.15 80);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.72 0.15 80);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0.03 60);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.72 0.15 80);
}

@layer base {
  * {
    border-color: var(--color-border);
    font-family: 'Noto Sans Thai', 'Noto Sans', sans-serif;
  }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}
```

---

## 2. Border Radius System (คัดลอกได้ทันที)

```
--radius: 0.75rem (12px)

ชื่อ         ค่า         ใช้กับ
sm          7.2px      badge, tag, chip
md          9.6px      button, input
lg          12px       card, dropdown
xl          16.8px     modal, sheet
2xl         21.6px     large card
3xl–4xl     26–31px    hero card, banner
full        9999px     pill button, avatar
```

---

## 3. Typography (คัดลอกได้ทันที)

### Font
```html
<!-- ใส่ใน index.html หรือ layout -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### Scale
```
text-xs     → hint, caption, micro label
text-sm     → body text, table cell, form input
text-base   → default paragraph
text-lg     → card title, subheading
text-2xl    → stat number, section title
text-3xl    → page title
text-4xl    → hero heading
```

### Page Header Pattern (จาก Kids Kingdom)
```tsx
<div className="border-b border-border/60 pb-5">
  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
    {subtitle}
  </p>
  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
    {title}
  </h1>
  <p className="text-sm text-muted-foreground">{description}</p>
</div>
```

---

## 4. Component Patterns (ถอดแบบโดยตรง)

### Button
```tsx
// Variants
default:     bg-primary text-primary-foreground hover:bg-primary/80
outline:     border border-border bg-background hover:bg-muted
secondary:   bg-secondary text-secondary-foreground
ghost:       hover:bg-muted (transparent)
destructive: bg-destructive/10 text-destructive

// Sizes
xs:    h-6  px-2   text-xs     rounded-[min(var(--radius-md),10px)]
sm:    h-7  px-2.5 text-[0.8rem] rounded-[min(var(--radius-md),12px)]
md:    h-8  px-2.5              rounded-lg
lg:    h-9  px-3               rounded-lg
icon:  size-8 (xs=6, sm=7, lg=9)
```

### Card
```tsx
<div className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 px-4">
  <div className="border-b border-border/60 pb-3 mb-4">
    <p className="text-base font-medium leading-snug">{title}</p>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
  {/* content */}
  <div className="bg-muted/50 -mx-4 -mb-4 mt-4 p-4 border-t rounded-b-xl">
    {/* footer */}
  </div>
</div>
```

### Stat Card (KPI Card)
```tsx
<div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
  <div className="flex items-center justify-between mb-3">
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <div className="p-2 rounded-lg bg-amber-50">  {/* เปลี่ยนสีตาม variant */}
      <Icon className="size-4 text-amber-600" />
    </div>
  </div>
  <p className="text-2xl font-bold">{value}</p>
  <p className="text-xs text-muted-foreground mt-1">{trend}</p>
</div>
```

**Stat Card Color Variants (ปรับให้ CHATEAU):**

| Variant | Background | Icon Color | ใช้กับ |
|---------|-----------|-----------|-------|
| gold | bg-amber-50 | text-amber-600 | Revenue, Booking |
| green | bg-emerald-50 | text-emerald-600 | Conversion, Success |
| blue | bg-blue-50 | text-blue-600 | Leads, Total |
| red | bg-rose-50 | text-rose-600 | Cancelled, Alert |
| brown | bg-stone-50 | text-stone-600 | Properties |

### Input Field
```tsx
<input className="
  h-8 w-full rounded-lg border border-input bg-transparent 
  px-2.5 py-1 text-sm 
  focus:border-ring focus:ring-3 focus:ring-ring/50 
  disabled:opacity-50 disabled:bg-input/50
  placeholder:text-muted-foreground
" />
```

### Topbar (Navigation Header)
```tsx
<header className="
  sticky top-0 z-10 h-16 
  flex items-center justify-between px-6 
  border-b border-border/60 
  bg-background/80 backdrop-blur
">
  <div>
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {scope}
    </p>
    <p className="text-sm font-semibold">{pageName}</p>
  </div>
  {/* right: notifications, user avatar */}
</header>
```

### Sidebar Navigation Item
```tsx
// Active
<a className="flex items-center gap-2.5 px-3 py-2 rounded-lg 
              bg-primary text-primary-foreground shadow-sm text-sm font-medium">
  <Icon className="size-4" />
  {label}
</a>

// Inactive
<a className="flex items-center gap-2.5 px-3 py-2 rounded-lg 
              text-foreground hover:bg-accent hover:text-accent-foreground 
              text-sm font-medium transition-colors">
  <Icon className="size-4" />
  {label}
</a>
```

### Badge
```tsx
// Status badges
<span className="inline-flex items-center gap-1 h-5 px-2 py-0.5 
                 rounded-full text-xs font-medium">
  {/* variants same as button */}
</span>

// CHATEAU status colors:
available:  bg-emerald-50 text-emerald-700
reserved:   bg-amber-50   text-amber-700
sold:       bg-blue-50    text-blue-700
rented:     bg-violet-50  text-violet-700
cancelled:  bg-rose-50    text-rose-700
lead:       bg-slate-100  text-slate-700
converted:  bg-emerald-50 text-emerald-700
```

### Table
```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b">
      <th className="h-10 px-2 text-left font-medium text-foreground">
        {heading}
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="p-2">{cell}</td>
    </tr>
  </tbody>
  <tfoot className="bg-muted/50 border-t font-medium">
    <tr><td className="p-2">{total}</td></tr>
  </tfoot>
</table>
```

### Dialog / Modal
```tsx
// Overlay
<div className="fixed inset-0 bg-black/10 backdrop-blur-xs animate-fade-in-0" />

// Content
<div className="
  fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
  w-full max-w-sm rounded-xl bg-popover p-4
  ring-1 ring-foreground/10 shadow-lg
  animate-zoom-in-95
">
  {children}
</div>
```

---

## 5. Layout Patterns

### Admin Layout (Sidebar + Content)
```tsx
<div className="flex h-screen">
  {/* Sidebar */}
  <aside className="w-64 border-r border-border/60 bg-sidebar flex flex-col">
    {/* Logo */}
    <div className="h-16 px-5 border-b border-border/60 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
        <Logo className="text-primary-foreground" />
      </div>
      <span className="font-semibold text-sm">CHATEAU</span>
    </div>
    {/* Nav */}
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {navItems}
    </nav>
    {/* User */}
    <div className="border-t border-border/60 p-3">
      {userProfile}
    </div>
  </aside>

  {/* Main */}
  <div className="flex-1 flex flex-col overflow-hidden">
    <Topbar />
    <main className="flex-1 overflow-y-auto p-6">
      {children}
    </main>
  </div>
</div>
```

### Stat Cards Grid
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard ... />
</div>
```

### Page Content
```tsx
<div className="space-y-6">
  <PageHeader title="..." subtitle="..." description="..." />
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {statCards}
  </div>
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {charts}
  </div>
</div>
```

---

## 6. Chart สำหรับ CHATEAU

### สี Chart (ปรับจาก Kids Kingdom)
```tsx
// แทนที่ #E60023 → ใช้ CHATEAU palette
const CHATEAU_CHART_COLORS = {
  primary:   '#ca8a04',  // gold
  secondary: '#8b5a2b',  // brown
  success:   '#10b981',  // green
  info:      '#3b82f6',  // blue
  danger:    '#ef4444',  // red
  muted:     '#9ca3af',  // gray
}

// Chart grid & axis
gridColor: '#e5e7eb'
axisStyle: { fontSize: 10, fill: '#737373' }
tooltipStyle: { fontSize: 12, borderRadius: 8 }

// Bar chart
<Bar radius={[6, 6, 0, 0]} fill={CHATEAU_CHART_COLORS.primary} />
```

---

## 7. สิ่งที่ต้องเปลี่ยนเพิ่มเติม (CHATEAU-specific)

| รายการ | Kids Kingdom | CHATEAU |
|--------|-------------|---------|
| Primary color | Red `#E60023` | Gold `#ca8a04` |
| Brand feel | Fun, colorful | Luxury, premium |
| Logo shape | Round corner | Square + gold accent |
| Sidebar logo bg | `bg-primary` (red) | `bg-primary` (gold) |
| Accent color | Warm red | Warm brown `#8b5a2b` |
| Success color | emerald | emerald (เหมือนเดิม) |
| Header subtitle color | text-primary (red) | text-primary (gold) |

---

## 8. Dependencies ที่ต้องติดตั้ง

```bash
# เพิ่มจาก Kids Kingdom (ที่ CHATEAU ยังไม่มี)
npm install @base-ui/react
npm install tw-animate-css
npm install class-variance-authority   # อาจมีแล้ว

# ที่มีอยู่แล้วใน CHATEAU
# shadcn/ui, lucide-react, recharts, clsx, tailwind-merge
```

---

## 9. สรุป: สิ่งที่ Copy ได้เลย vs ต้องปรับ

### ✅ Copy โครงสร้างได้เลย
- CSS variable structure ทั้งหมด (เปลี่ยนแค่ primary color)
- Border radius system
- Component sizing system (xs, sm, md, lg, icon)
- Layout patterns (sidebar + topbar + content)
- Table, Card, Input, Button, Badge patterns
- Chart color system (เปลี่ยนสีเท่านั้น)
- Page Header pattern
- Stat Card pattern

### 🔄 ต้องปรับสีให้เป็น CHATEAU
- Primary: Red → Gold (`oklch(0.62 0.15 80)`)
- Accent: Warm pink → Warm brown (`oklch(0.55 0.10 60)`)
- Sidebar primary: Red → Gold

### 🆕 ต้องออกแบบใหม่สำหรับ CHATEAU
- Customer Portal pages (ไม่มีใน Kids Kingdom)
- Property gallery / unit viewer  
- Booking flow UI
- Lead scoring visualization
