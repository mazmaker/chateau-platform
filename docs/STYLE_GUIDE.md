# CHATEAU Platform - Style Guide
**Design System Reference** | **Version 2.0** | **Luxury White Theme**

---

## 🎨 **Color Palette**

### **Primary Colors**
```
⬜ Background     #FFFFFF    สีพื้นหลังหลัก
⬛ Primary        #1F2937    สีหลัก (ปุ่ม, text สำคัญ)
🔘 Secondary      #F3F4F6    สีรอง (พื้นหลัง hover)
🔳 Border         #E5E7EB    สีขอบ, เส้นแบ่ง
```

### **Text Colors**
```
⚫ Primary Text   #1F2937    ข้อความหลัก (headers, labels)
🔘 Secondary Text #6B7280    ข้อความรอง (descriptions)
🔳 Muted Text     #9CA3AF    ข้อความเบา (hints, captions)
```

### **Status Colors**
```
🟢 Success       #10B981    สีเขียว (สำเร็จ, approved)
🟡 Warning       #F59E0B    สีเหลือง (รอการอนุมัติ, pending)
🔴 Error         #EF4444    สีแดง (ข้อผิดพลาด, rejected)
🔵 Info          #3B82F6    สีฟ้า (ข้อมูล, notifications)
```

---

## 🔘 **Buttons**

### **Primary Button**
```css
Background: linear-gradient(135deg, #1F2937 0%, #374151 100%)
Text: #FFFFFF
Border: none
Radius: 12px (rounded-xl)
Padding: 12px 24px (py-3 px-6)
Shadow: 0 2px 8px rgba(0,0,0,0.2)

Hover: เข้มขึ้น + shadow เพิ่ม
```

### **Secondary Button**
```css
Background: #FFFFFF
Text: #1F2937
Border: 1px solid #E5E7EB
Radius: 12px
Padding: 12px 24px
Shadow: 0 1px 3px rgba(0,0,0,0.1)

Hover: Background #F9FAFB
```

### **Outline Button**
```css
Background: transparent
Text: #1F2937
Border: 1px solid #D1D5DB
Radius: 12px
Padding: 12px 24px

Hover: Background #F3F4F6
```

---

## 📦 **Cards**

### **Standard Card**
```css
Background: #FFFFFF
Border: 1px solid #E5E7EB
Radius: 12px (rounded-xl)
Shadow: 0 2px 12px rgba(0,0,0,0.05)
Padding: 16px-32px (p-4 to p-8)

Hover: Shadow เพิ่ม + translateY(-2px)
```

### **Stat Card**
```css
Background: #FFFFFF
Border: 1px solid #E5E7EB
Radius: 12px
Shadow: 0 2px 12px rgba(0,0,0,0.05)
Top Border: 3px gradient (#1F2937 → #4B5563)

Content:
- Number: text-2xl font-bold #1F2937
- Label: text-sm #6B7280
```

---

## 📝 **Forms**

### **Input Field**
```css
Background: #FFFFFF
Border: 1px solid #E5E7EB
Radius: 12px
Padding: 12px 16px (py-3 px-4)
Text: #1F2937

Focus:
- Border: #374151
- Ring: 2px rgba(31,41,55,0.2)
- Outline: none
```

### **Select Dropdown**
```css
Same as Input Field +
- Chevron icon: #6B7280
- Options: white background
```

---

## 🧭 **Navigation**

### **Sidebar**
```css
Background: #FFFFFF
Width: 260px
Border: 1px solid #E5E7EB (right)
Shadow: 0 4px 20px rgba(0,0,0,0.1)
```

### **Nav Item (Normal)**
```css
Background: transparent
Text: #6B7280
Icon: #6B7280
Padding: 12px 16px (py-3 px-4)
Radius: 12px

Hover:
- Background: #F3F4F6
- Text: #1F2937
```

### **Nav Item (Active)**
```css
Background: #F3F4F6
Text: #1F2937 font-semibold
Icon: #374151
Border: 1px solid #D1D5DB
Shadow: 0 1px 3px rgba(0,0,0,0.1)
```

---

## 📊 **Tables**

### **Table Header**
```css
Background: #F9FAFB
Text: #374151 font-semibold
Border-bottom: 2px solid #E5E7EB
Padding: 16px 24px (py-4 px-6)
```

### **Table Row**
```css
Background: #FFFFFF
Border-bottom: 1px solid #F3F4F6
Padding: 12px 24px (py-3 px-6)

Hover: Background #F9FAFB
```

---

## 🏷️ **Tags & Badges**

### **Status Badge**
```css
Success: bg-green-100 text-green-800 border-green-200
Warning: bg-yellow-100 text-yellow-800 border-yellow-200
Error: bg-red-100 text-red-800 border-red-200
Info: bg-blue-100 text-blue-800 border-blue-200

Radius: 9999px (rounded-full)
Padding: 4px 12px (py-1 px-3)
Font: text-xs font-medium
```

---

## 🖼️ **Layout**

### **Page Container**
```css
Background: #FFFFFF
Min-height: 100vh
Padding: 24px (p-6)
```

### **Content Spacing**
```css
Section Gap: 24px (space-y-6)
Card Gap: 24px (gap-6)
Grid Gap: 16px-24px (gap-4 to gap-6)
```

---

## 🌟 **Effects**

### **Shadows**
```css
Small: 0 1px 2px rgba(0,0,0,0.05)
Medium: 0 4px 6px rgba(0,0,0,0.1)
Large: 0 10px 15px rgba(0,0,0,0.1)
XLarge: 0 20px 25px rgba(0,0,0,0.1)
```

### **Transitions**
```css
All: transition-all duration-200 ease-in-out
Colors: transition-colors duration-200
Shadow: transition-shadow duration-200
```

---

## 📏 **Spacing Scale**

```
4px   = 1 unit  (p-1, m-1, gap-1)
8px   = 2 units (p-2, m-2, gap-2)
12px  = 3 units (p-3, m-3, gap-3)
16px  = 4 units (p-4, m-4, gap-4)
24px  = 6 units (p-6, m-6, gap-6)
32px  = 8 units (p-8, m-8, gap-8)
```

---

## 📱 **Responsive**

```
Mobile:   < 768px   (1 column, overlay sidebar)
Tablet:   768px+    (2 columns, overlay sidebar)
Desktop:  1024px+   (3+ columns, fixed sidebar)
```

---

## 🎭 **States**

### **Loading**
```css
Background: #F9FAFB
Animation: pulse (opacity 1 → 0.5 → 1)
```

### **Disabled**
```css
Background: #F3F4F6
Text: #9CA3AF
Cursor: not-allowed
Opacity: 0.5
```

### **Focus**
```css
Ring: 2px rgba(31,41,55,0.2)
Border: #374151
Outline: none
```

---

## 📦 **Components Quick Reference**

| Component | Background | Border | Text | Padding |
|-----------|------------|---------|------|---------|
| **Primary Button** | `#1F2937` gradient | none | `#FFFFFF` | `py-3 px-6` |
| **Card** | `#FFFFFF` | `#E5E7EB` | `#1F2937` | `p-4 to p-8` |
| **Input** | `#FFFFFF` | `#E5E7EB` | `#1F2937` | `py-3 px-4` |
| **Nav Active** | `#F3F4F6` | `#D1D5DB` | `#1F2937` | `py-3 px-4` |
| **Table Header** | `#F9FAFB` | `#E5E7EB` | `#374151` | `py-4 px-6` |

---

**🎨 Copy hex codes ได้เลย! • 📋 ใช้เป็น reference ตอนออกแบบ • 🏗️ Consistent across platform**