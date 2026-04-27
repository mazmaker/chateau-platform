# CHATEAU Platform - Sub-Agents

**Version:** 1.0.0
**Last Updated:** 2025-12-25

---

## 🤖 Sub-Agents สำหรับ CHATEAU Platform

4 AI Agents พร้อม activation prompts สำหรับจัดการโปรเจค CHATEAU Platform

---

## 📋 Agents Overview

| Agent | MCP | หน้าที่ | Priority |
|:---|:---|:---|:---:|
| **Supabase Agent** | supabase + context7 | ฐานข้อมูล, RLS, Migrations | ⭐⭐⭐⭐⭐ |
| **Shadcn Agent** | shadcn + context7 | UI Components, Styling | ⭐⭐⭐⭐ |
| **Playwright Agent** | playwright + context7 | E2E Tests, QA | ⭐⭐⭐⭐ |
| **Context7 Agent** | context7 | Memory, Decisions, Cross-ref | ⭐⭐⭐⭐⭐ |

---

## 🚀 วิธีใช้งาน

### เรียกใช้ Agent:

```bash
# เลือก Agent ตามงานที่ต้องการ
/task "แก้ RLS policy สำหรับ bookings table" → Supabase Agent
/task "เพิ่ม error boundary component" → Shadcn Agent
/task "เขียน E2E tests สำหรับ login flow" → Playwright Agent
/task "เราตัดสินใจเรื่อง tenant isolation ยังไง" → Context7 Agent
```

### Activation Prompt:

เลือก Agent แล้ว copy prompt จากไฟล์ด้านล่าง:

1. **[Supabase Agent](./supabase-agent.md)** - สถาปนิกฐานข้อมูล
2. **[Shadcn Agent](./shadcn-agent.md)** - สถาปนิก UI/UX
3. **[Playwright Agent](./playwright-agent.md)** - หัวหน้า QA
4. **[Context7 Agent](./context7-agent.md)** - ผู้ดูแลความจำ

---

## 📊 Agent Responsibilities

### Supabase Agent 🔵
- เขียน SQL migrations
- ออกแบบ RLS policies
- Optimize queries
- PDPA compliance

### Shadcn Agent 🟣
- สร้าง shadcn/ui components
- รักษา UI consistency
- Accessibility & Responsive
- Performance optimization

### Playwright Agent 🟢
- เขียน E2E tests
- Multi-tenant isolation tests
- Role-based access tests
- Performance testing

### Context7 Agent 🟡
- เก็บ decisions ทั้งหมด
- Cross-reference documents
- จดจำ user flows
- Track task dependencies

---

## 🎯 การประสานงาน

### Daily Standup Prompt:
```
ทีมรายงานสถานะ:

1. Context7: สรุป decisions จากเมื่อวาน
2. Supabase: Database changes, RLS updates
3. Shadcn: UI components ที่เสร็จ
4. Playwright: Test results และ coverage

แผนวันนี้:
- Tasks จาก specs/002-production-readiness/tasks.md
- Dependencies ที่ต้องจัดการ
- มอบหมายความรับผิดชอบ
```

---

## 📁 File Structure

```
.claude/
├── agents/
│   ├── README.md                    # ไฟล์นี้
│   ├── supabase-agent.md            # Supabase Agent prompt
│   ├── shadcn-agent.md              # Shadcn Agent prompt
│   ├── playwright-agent.md          # Playwright Agent prompt
│   └── context7-agent.md            # Context7 Agent prompt
└── settings.local.json              # MCP configuration
```

---

## 🔗 Related Documents

- **Constitution:** `.specify/memory/constitution.md`
- **PRD:** `documents/PRD.md`
- **Tasks:** `specs/002-production-readiness/tasks.md`
- **Plan:** `specs/002-production-readiness/plan.md`

---

## ✅ Checklists

### ก่องใช้ Supabase Agent:
- [ ] ตรวจสอบ requirements จาก PRD
- [ ] Cross-check กับ Context7
- [ ] ทดสอบ RLS กับทุก role

### ก่อนใช้ Shadcn Agent:
- [ ] เช็คว่าไม่กระทบ UI ที่มี
- [ ] ดู patterns จาก components ที่มี
- [ ] ทดสอบ responsive

### ก่อนใช้ Playwright Agent:
- [ ] รู้ว่า feature ทำอะไร
- [ ] เช็ค requirements จาก PRD
- [ ] เตรียม test data

### ก่อนใช้ Context7 Agent:
- [ ] รู้ว่าต้องการค้นหาอะไร
- [ ] มี keywords พร้อม
- [ ] พร้อมอ้างอิง sources

---

**Created:** 2025-12-25
**Project:** CHATEAU Platform
**Status:** Active
