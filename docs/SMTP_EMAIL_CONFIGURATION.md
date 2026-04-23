# SMTP Email Configuration Guide

**Last Updated**: 2025-01-07
**Purpose**: Guide for configuring email sending in CHATEAU Platform

---

## 📧 Overview

CHATEAU Platform uses Supabase Auth for email sending. Currently, the system works in **development mode** without email sending - admins copy invite links manually. For **production**, you need to configure SMTP settings.

---

## 🚀 Quick Setup (Recommended: Resend)

### Why Resend?
- ✅ Free tier: 3,000 emails/month
- ✅ Easy setup with Supabase
- ✅ Good deliverability
- ✅ Simple API
- ✅ Supports transactional emails

---

## Step 1: Create Resend Account

1. Go to [https://resend.com/](https://resend.com/)
2. Sign up for free account
3. Verify your email address

### Option A: Use Your Own Domain (Recommended for Production)

1. **Add Your Domain**:
   - Go to [https://resend.com/domains](https://resend.com/domains)
   - Click "Add Domain"
   - Enter your domain (e.g., `yourcompany.com`)
   - Click "Add Domain"

2. **Configure DNS Records**:
   Resend will show you DNS records to add to your domain:

   ```
   Type: TXT
   Name: _dmarc
   Value: v=DMARC1; p=none

   Type: TXT
   Name: resend._domainkey
   Value: (provided by Resend)

   Type: CNAME
   Name: resend._domainkey
   Value: (provided by Resend)
   ```

3. **Wait for Verification** (usually 5-30 minutes)

4. **Create API Key**:
   - Go to [https://resend.com/api-keys](https://resend.com/api-keys)
   - Click "Create API Key"
   - Give it a name (e.g., "CHATEAU Production")
   - Copy the API key (you'll need it later)

### Option B: Use Resend's Free Domain (For Testing)

1. **Use Resend's Domain**:
   - Skip domain verification
   - Use `@resend.dev` email addresses
   - Note: Limited functionality, not recommended for production

2. **Create API Key** (same as above)

---

## Step 2: Configure Supabase SMTP Settings

### Option A: Via Supabase Dashboard (Recommended)

1. **Go to Your Supabase Project**:
   - Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Navigate to Authentication Settings**:
   - Go to **Authentication** → **Email Templates** (or **Settings** → **Auth**)

3. **Configure SMTP Settings**:
   - Find **SMTP Settings** section
   - Enable **Custom SMTP**
   - Fill in the following:

   ```
   SMTP Host: smtp.resend.com
   SMTP Port: 587 (or 2525)
   SMTP User: resend
   SMTP Password: [YOUR_RESEND_API_KEY]
   Sender Email: [YOUR_VERIFIED_EMAIL] (e.g., noreply@yourcompany.com)
   Sender Name: CHATEAU Platform
   ```

4. **Test Connection**:
   - Click "Test SMTP Settings"
   - Check if test email arrives

5. **Enable Email Confirmation**:
   - Make sure **Enable Email Confirmations** is ON
   - This ensures users must verify their email

### Option B: Via Supabase CLI (For Advanced Users)

```bash
# Update your project config
npx supabase config set smtp.host=smtp.resend.com
npx supabase config set smtp.port=587
npx supabase config set smtp.user=resend
npx supabase config set smtp.password=YOUR_API_KEY
npx supabase config set smtp.sender_email=noreply@yourcompany.com
npx supabase config set smtp.sender_name=CHATEAU Platform

# Push to remote
npx supabase db push
```

---

## Step 3: Configure Redirect URLs

1. **Go to URL Configuration**:
   - In Supabase Dashboard → **Authentication** → **URL Configuration**

2. **Add Your Redirect URLs**:

   ### For Development:
   ```
   http://localhost:5175/**
   http://localhost:5174/**
   ```

   ### For Production:
   ```
   https://your-production-domain.com/**
   https://chateau.yourcompany.com/**
   ```

3. **Save Changes**

---

## Step 4: Customize Email Templates (Optional)

1. **Go to Email Templates**:
   - Supabase Dashboard → **Authentication** → **Email Templates**

2. **Customize Invite Email**:
   - Find **"Invite User"** or **"Email Confirmation"** template
   - Customize the subject and body

   Example Template:
   ```html
   <h2>คำเชิญเข้าร่วม CHATEAU Platform</h2>

   <p>สวัสดีครับ/ค่ับ {{ .Email }}</p>

   <p>คุณได้รับเชิญให้เข้าร่วม {{ .SiteName }} เพื่อจัดการอสังหาฯ</p>

   <p>คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านและเริ่มใช้งาน:</p>

   <p><a href="{{ .ConfirmationURL }}" class="button">เริ่มใช้งาน</a></p>

   <p>หรือคัดลอกลิงก์นี้ไปยังเบราว์เซอร์:</p>
   <p>{{ .ConfirmationURL }}</p>

   <p>ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง</p>
   ```

3. **Save Template**

---

## Step 5: Update Application Code (Optional Enhancement)

### Currently Implemented (Manual Copy Flow)

The current flow works without SMTP:
- Admin creates user → Gets invite link → Copies link manually
- User opens link → Sets password → Account created

### With SMTP Configured (Automated Email)

You can optionally update the code to automatically send emails:

#### Update [InviteUserModal.tsx](../src/components/users/InviteUserModal.tsx):

```typescript
// After successful invite, show success message
if (data?.success && data.invite_token) {
  toast.success('ส่งคำเชิญเรียบร้อย! ตรวจสอบอีเมล์ของผู้ใช้');
  // The invite link format:
  const inviteLink = `${window.location.origin}/auth/accept-invite?token=${data.invite_token}`;
  console.log('Invite link:', inviteLink);
}
```

**Note**: The current code already shows the invite link for manual copying, which works as a backup even when SMTP is configured.

---

## Step 6: Test Email Sending

### Test 1: Send Test Email from Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click **"Test Email Delivery"**
3. Enter your test email
4. Check your inbox

### Test 2: Test via Application

1. Open your CHATEAU app
2. Go to **Users** page
3. Click **"Invite User"**
4. Enter a test email address
5. Check the email inbox

### Test 3: Check Resend Logs

1. Go to [https://resend.com/logs](https://resend.com/logs)
2. Verify emails are being sent
3. Check for any errors

---

## 🔧 Troubleshooting

### Issue: Emails not arriving

**Checklist:**
- [ ] SMTP settings correctly configured
- [ ] API key is valid
- [ ] Domain is verified (if using custom domain)
- [ ] Sender email matches verified domain
- [ ] Redirect URLs include your domain
- [ ] Check spam/junk folder

### Issue: "Email sending failed" error

**Solutions:**
1. Verify SMTP settings in Supabase Dashboard
2. Test connection from Supabase Dashboard
3. Check Resend API key permissions
4. Verify sender email matches verified domain

### Issue: Users can't click email links

**Solutions:**
1. Check redirect URLs configuration
2. Ensure `/**` is included in URL patterns
3. Verify base URL in your app's config

---

## 🌍 Environment Variables Reference

No additional environment variables needed! Everything is configured in Supabase Dashboard.

However, for your reference:

```env
# .env.local (already configured)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📊 Email Provider Comparison

| Provider | Free Tier | Cost | Pros | Cons |
|----------|-----------|------|------|------|
| **Resend** | 3,000/month | From $20/month | Easy setup, good API | Newer service |
| **SendGrid** | 100/day | From $19/month | Established, reliable | Complex setup |
| **AWS SES** | 200/day | Pay per use | Cheapest at scale | Complex setup |
| **Postmark** | 1,000/month | From $15/month | Great deliverability | No free tier forever |

**Recommendation**: Start with **Resend** for easiest setup.

---

## 🚀 Production Checklist

Before going live with email:

- [ ] SMTP configured and tested
- [ ] Custom domain verified
- [ ] Redirect URLs updated
- [ ] Email templates customized
- [ ] Test email sent successfully
- [ ] Spam filters tested (send to Gmail, Outlook, etc.)
- [ ] Reply-to address configured
- [ ] Bounce/Complaint handling set up

---

## 📚 Additional Resources

- [Supabase Auth Email Templates](https://supabase.com/docs/guides/auth/auth-email)
- [Resend Documentation](https://resend.com/docs)
- [Supabase SMTP Settings](https://supabase.com/docs/guides/auth/social-login/auth-smtp)

---

## ❓ FAQ

**Q: Can I change email provider later?**
A: Yes! Just update SMTP settings in Supabase Dashboard. No code changes needed.

**Q: What happens to existing users?**
A: Nothing changes. SMTP only affects new emails being sent.

**Q: Can I use Gmail for sending?**
A: Not recommended. Gmail has strict limits and may block your account. Use a proper transactional email service.

**Q: Do I need to update the code when SMTP is configured?**
A: No! The current code already handles both cases:
- With SMTP: Automatic email sending
- Without SMTP: Manual link copying (backup)

**Q: How much does it cost?**
A: Resend free tier = 3,000 emails/month (good for small teams). Paid plans start at $20/month for 50,000 emails.

---

## ✅ Summary

1. **Development (Current)**: Admin copies invite link manually
2. **Production**: Configure SMTP → Automatic email sending
3. **Recommended**: Resend for easy setup and good free tier
4. **No Code Changes**: Current code works with or without SMTP

---

**Need Help?**
- Check Supabase Dashboard logs
- Check Resend logs
- Review this guide's troubleshooting section
