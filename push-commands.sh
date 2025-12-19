#!/bin/bash
# Commands to push to remote repository

echo "=== Push CHATEAU Platform to Remote Repository ==="
echo ""
echo "1. สร้าง repository บน GitHub ก่อน: https://github.com/new"
echo "   Repository name: chateau-platform"
echo "   Description: Multi-tenant Property Management SaaS Platform"
echo ""
echo "2. แทนที่ YOUR_USERNAME ในคำสั่งข้างล่างนี้"
echo ""

# แทนที่ YOUR_USERNAME ด้วย GitHub username ของคุณ
YOUR_USERNAME="YOUR_USERNAME"

# คำสั่งสำหรับ remote และ push
echo "# รันคำสั่งเหล่านี้:"
echo "git remote add origin https://github.com/${YOUR_USERNAME}/chateau-platform.git"
echo "git branch -M main"
echo "git push -u origin main"
echo ""
echo "# หรือถ้าต้องการรักษาชื่อ branch 001-production-readiness:"
echo "git remote add origin https://github.com/${YOUR_USERNAME}/chateau-platform.git"
echo "git push -u origin 001-production-readiness"
echo ""

# ถ้าต้องการ push ไป branch ปัจจุบัน
echo "Current branch: $(git branch --show-current)"
echo ""
echo "=== Ready to push! ==="