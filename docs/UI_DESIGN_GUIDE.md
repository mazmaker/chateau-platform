# CHATEAU Platform - UI Design Guide
**Version 2.0** | **Luxury White Theme** | **Updated: April 2026**

---

## 🎨 Design Philosophy

**"Sophisticated Simplicity"**  
Modern luxury real estate platform with clean white backgrounds, subtle gray accents, and premium user experience.

---

## 🎯 Core Principles

### 1. **Luxury & Elegance**
- Clean white backgrounds throughout
- Minimal color palette with strategic gray accents
- Premium typography and spacing
- Subtle shadows for depth

### 2. **Clarity & Focus**  
- Clear visual hierarchy
- Consistent spacing system
- High contrast for readability
- Purposeful color usage

### 3. **Professional Trust**
- Consistent branding elements
- Reliable interaction patterns
- Clear status indicators
- Professional color schemes

---

## 🎨 Color System

### **Primary Palette**
```css
/* Backgrounds */
--background: #FFFFFF           /* Main background */
--card: #FFFFFF                 /* Card backgrounds */
--secondary: #F3F4F6           /* Light gray background */

/* Text */
--foreground: #1F2937          /* Primary text */
--muted-foreground: #6B7280    /* Secondary text */

/* Accents */
--primary: #1F2937             /* Primary actions */
--border: #E5E7EB             /* Borders */
--ring: #1F2937               /* Focus rings */
```

### **Semantic Colors**
```css
/* Status Colors */
--success: #10B981     /* Green - Success states */
--warning: #F59E0B     /* Amber - Warning states */  
--error: #EF4444       /* Red - Error states */
--info: #3B82F6        /* Blue - Info states */

/* Role Colors */
--owner: #F59E0B       /* Gold - Owner role */
--admin: #3B82F6       /* Blue - Admin role */
--sales: #10B981       /* Green - Sales role */
```

### **Chart & Data Colors**
```css
--chart-1: #1F2937     /* Primary gray */
--chart-2: #374151     /* Medium gray */
--chart-3: #10B981     /* Green */
--chart-4: #F59E0B     /* Orange */
--chart-5: #EF4444     /* Red */
```

---

## 📝 Typography

### **Font Family**
```css
font-family: 'Noto Sans Thai', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

### **Type Scale**
```css
/* Headers */
.text-3xl { font-size: 1.875rem; line-height: 2.25rem; } /* 30px */
.text-2xl { font-size: 1.5rem; line-height: 2rem; }     /* 24px */
.text-xl  { font-size: 1.25rem; line-height: 1.75rem; } /* 20px */
.text-lg  { font-size: 1.125rem; line-height: 1.75rem; }/* 18px */

/* Body Text */
.text-base { font-size: 1rem; line-height: 1.5rem; }    /* 16px */
.text-sm   { font-size: 0.875rem; line-height: 1.25rem; } /* 14px */
.text-xs   { font-size: 0.75rem; line-height: 1rem; }   /* 12px */
```

### **Font Weights**
```css
.font-light    { font-weight: 300; }
.font-normal   { font-weight: 400; }
.font-medium   { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold     { font-weight: 700; }
```

---

## 🧩 Component Library

### **Buttons**

#### Primary Button
```css
.btn-primary {
  background: linear-gradient(135deg, #1F2937 0%, #374151 100%);
  color: #FFFFFF;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border-radius: 0.75rem;
  padding: 0.75rem 1.5rem;
  font-weight: 500;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #111827 0%, #1F2937 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

#### Secondary Button
```css
.btn-secondary {
  background: #FFFFFF;
  color: #1F2937;
  border: 1px solid #E5E7EB;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

### **Cards**

#### Standard Card
```css
.card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 0.75rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
```

#### Stat Card
```css
.stat-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #1F2937, #374151, #4B5563);
}
```

### **Forms**

#### Input Field
```css
.input {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

.input:focus {
  outline: none;
  ring: 2px solid rgba(31, 41, 55, 0.2);
  border-color: #374151;
}
```

---

## 📐 Spacing System

### **Spacing Scale**
```css
.p-1  { padding: 0.25rem; }    /* 4px */
.p-2  { padding: 0.5rem; }     /* 8px */
.p-3  { padding: 0.75rem; }    /* 12px */
.p-4  { padding: 1rem; }       /* 16px */
.p-6  { padding: 1.5rem; }     /* 24px */
.p-8  { padding: 2rem; }       /* 32px */
.p-12 { padding: 3rem; }       /* 48px */
```

### **Layout Spacing**
- **Page margins:** `p-6` (24px)
- **Card padding:** `p-4` to `p-8` (16px-32px)
- **Button padding:** `px-6 py-3` (24px x 12px)
- **Section spacing:** `space-y-6` (24px vertical)

---

## 🌟 Effects & Animations

### **Shadows**
```css
/* Card Shadows */
.shadow-sm   { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
.shadow      { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
.shadow-md   { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
.shadow-lg   { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
.shadow-xl   { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
```

### **Transitions**
```css
.transition-all { transition: all 0.3s ease; }
.transition-colors { transition: color 0.2s ease; }
.transition-shadow { transition: box-shadow 0.2s ease; }
```

### **Hover Effects**
```css
/* Cards */
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* Buttons */
.button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

---

## 🎯 Interactive States

### **Focus States**
```css
.focus-ring {
  focus:outline-none;
  focus:ring-2;
  focus:ring-gray-300;
  focus:border-gray-400;
}
```

### **Active States**
```css
/* Navigation */
.nav-active {
  background: #F3F4F6;
  color: #1F2937;
  font-weight: 600;
  border-left: 3px solid #1F2937;
}

/* Tabs */
.tab-active {
  background: #F3F4F6;
  color: #1F2937;
  font-weight: 600;
  border: 1px solid #D1D5DB;
}
```

---

## 🔧 Layout Patterns

### **Page Structure**
```html
<div class="min-h-screen bg-background">
  <Sidebar />
  <div class="lg:pl-[260px]">
    <Header />
    <main class="p-6 space-y-6">
      <!-- Page content -->
    </main>
  </div>
</div>
```

### **Card Grid**
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card />
  <Card />
  <Card />
</div>
```

### **Form Layout**
```html
<div class="space-y-6">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField />
    <FormField />
  </div>
</div>
```

---

## 🎨 Brand Elements

### **Logo Treatment**
- **Primary:** Full color CHATEAU logo
- **Monochrome:** Gray (#374151) for subdued contexts
- **Size variants:** sm, md, lg, xl, 2xl

### **Icons**
- **Library:** Lucide React
- **Style:** Outline style, consistent stroke width
- **Sizes:** w-4 h-4 (16px), w-5 h-5 (20px), w-6 h-6 (24px)

### **Avatars**
```css
.avatar {
  background: linear-gradient(135deg, #374151 0%, #1F2937 100%);
  color: #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
```

---

## 📊 Data Visualization

### **Chart Colors**
```css
--chart-primary: #1F2937     /* Main data series */
--chart-secondary: #374151   /* Secondary series */
--chart-accent-1: #10B981    /* Success/positive */
--chart-accent-2: #F59E0B    /* Warning/neutral */
--chart-accent-3: #EF4444    /* Error/negative */
```

### **Chart Styling**
- **Grid lines:** `stroke="#F0F0F0"`
- **Axis text:** `fill="#6B7280"`
- **Tooltips:** White background, gray border
- **Legends:** Below charts, horizontal layout

---

## 🔒 Accessibility

### **Color Contrast**
- **Text on white:** Minimum 4.5:1 ratio
- **Interactive elements:** Minimum 3:1 ratio
- **Focus indicators:** 2px outline, high contrast

### **Touch Targets**
- **Minimum size:** 44px x 44px
- **Button padding:** Adequate spacing for touch
- **Interactive spacing:** Minimum 8px between elements

---

## 📱 Responsive Design

### **Breakpoints**
```css
/* Mobile First */
.sm   { min-width: 640px; }   /* Small devices */
.md   { min-width: 768px; }   /* Tablets */
.lg   { min-width: 1024px; }  /* Laptops */
.xl   { min-width: 1280px; }  /* Desktops */
.2xl  { min-width: 1536px; }  /* Large screens */
```

### **Mobile Adaptations**
- **Sidebar:** Overlay on mobile, fixed on desktop
- **Grid:** Single column on mobile, multi-column on larger screens
- **Typography:** Responsive font sizes
- **Touch:** Larger touch targets on mobile

---

## 🎭 Component States

### **Loading States**
```css
.loading {
  background: #F9FAFB;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}
```

### **Empty States**
- **Illustration:** Simple line art in gray
- **Message:** Clear, actionable text
- **CTA:** Primary button to resolve

### **Error States**
- **Color:** Red accent (`#EF4444`)
- **Icon:** Error icon with consistent styling
- **Message:** Clear error description and next steps

---

## 🚀 Implementation Notes

### **CSS Custom Properties**
All colors defined as CSS custom properties in `:root` for easy theming and consistency.

### **Utility Classes**
Built on Tailwind CSS for rapid development and consistent spacing/sizing.

### **Component Consistency**
All components follow the same design patterns for predictable user experience.

### **Performance**
- Minimal CSS bundle
- Optimized animations
- Efficient rendering

---

## 📈 Usage Examples

### **Dashboard Cards**
```jsx
<Card className="bg-white border-gray-200 shadow-lg hover:shadow-xl transition-all">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg font-semibold text-gray-900">
      Card Title
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold text-gray-900">258</div>
    <p className="text-sm text-gray-500">Description</p>
  </CardContent>
</Card>
```

### **Navigation Items**
```jsx
<button className={cn(
  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
  "hover:bg-gray-100 group text-left",
  isActive && "bg-gray-100 border border-gray-300 shadow-sm",
  isActive ? "text-gray-900 font-semibold" : "text-gray-600"
)}>
  <Icon className="w-5 h-5" />
  <span>Navigation Item</span>
</button>
```

---

*This design guide ensures consistency across the CHATEAU platform while maintaining the luxury, professional aesthetic appropriate for a premium real estate PropTech solution.*