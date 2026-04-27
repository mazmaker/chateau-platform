#!/bin/bash

echo ""
echo "============================================================"
echo "   CHATEAU Platform - One Click Setup"
echo "============================================================"
echo ""
echo "กำลังเปิดหน้าเว็บที่ต้องใช้..."
echo ""

# Open the exact pages needed
open "https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/auth/users"
sleep 2
open "https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql"

echo ""
echo "============================================================"
echo "   ทำตามนี้ (แค่ 1 ครั้ง):"
echo "============================================================"
echo ""
echo "1️⃣  หน้า Users (ที่เปิดอยู่):"
echo "   - กดปุ่ม 'Add user' หรือ 'New user'"
echo "   - Email: mazmakerv2.sup@gmail.com"
echo "   - Password: Chateau2025!"
echo "   - ✅ ติ๊ก 'Auto Confirm User'"
echo "   - กด 'Create user'"
echo ""
echo "2️⃣  หน้า SQL Editor (แท็บที่ 2):"
echo "   - วาง SQL นี้แล้วกด RUN:"
echo ""
echo "      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;"
echo ""
echo "3️⃣  กลับมาที่ terminal นี้ แล้วกด Enter..."
echo ""
echo "============================================================"
echo ""

# Wait for user
read -p "Press Enter after creating user in Supabase..."

echo ""
echo "🚀 กำลังตั้งค่า Tenant และสิทธิ์ OWNER..."
echo ""

node "/Users/baituaykitty/Desktop/MAZ/ CHATEAU PLATFORM/setup-user-direct.js"

echo ""
echo "============================================================"
echo "   เสร็จสิ้น! ไป Login ได้เลย"
echo "============================================================"
echo ""

open "http://localhost:5174/auth/login"
