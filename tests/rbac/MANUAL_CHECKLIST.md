# RBAC Manual Testing Checklist

Use this checklist to manually verify RBAC functionality before running automated tests.

## Pre-Test Setup

### Environment Check
- [ ] Dev server running on `http://localhost:5175`
- [ ] Database connection active
- [ ] Test users exist in database
- [ ] Browser cleared of old sessions

### Test Users Verification
- [ ] Owner: `mazmakerv2.sup@gmail.com` (role = owner)
- [ ] Admin: `admin@chateau.com` (role = admin, password = Chateau@2024)
- [ ] Sales: `sales@chateau.com` (role = sales, password = Chateau@2024)

---

## OWNER ROLE TESTS (👑)

### Login & Authentication
- [ ] Login with owner credentials succeeds
- [ ] Redirected to dashboard after login
- [ ] Session persists across page refresh
- [ ] Role badge shows crown icon (👑) or "Owner/เจ้าของ"
- [ ] User menu displays correct email

### Page Access - Owner Dashboard
- [ ] Navigate to `/owner` - should succeed
- [ ] See "Owner Dashboard" header
- [ ] See platform metrics (MRR, ARR, etc.)
- [ ] See "Add Company" button
- [ ] No "Access Denied" message

### Page Access - Tenant Management
- [ ] Navigate to `/tenants` - should succeed
- [ ] See "จัดการบริษัท (Tenants)" header
- [ ] See tenant list table
- [ ] See "Add Tenant" button
- [ ] No "Access Denied" message

### Page Access - Billing Management
- [ ] Navigate to `/billing` - should succeed
- [ ] See billing information
- [ ] See subscription plans
- [ ] See payment history
- [ ] No "Access Denied" message

### Page Access - Property Management
- [ ] Navigate to `/properties` - should succeed
- [ ] See "โครงการและยูนิต" header
- [ ] See property list
- [ ] See "Add Property" button
- [ ] See delete buttons (owner has delete permission)

### Page Access - Lead Management
- [ ] Navigate to `/leads` - should succeed
- [ ] See lead management interface
- [ ] See lead list
- [ ] No "Access Denied" message

### Navigation
- [ ] See all navigation items
- [ ] See "Owner Dashboard" link
- [ ] See "Tenants" link
- [ ] See "Billing" link
- [ ] See all other links

---

## ADMIN ROLE TESTS (🔧)

### Login & Authentication
- [ ] Login with admin credentials succeeds
- [ ] Redirected to dashboard after login
- [ ] Session persists across page refresh
- [ ] Role badge shows shield icon (🔧) or "Admin/ผู้ดูแล"
- [ ] User menu displays correct email

### Page Access - Owner Dashboard (NEGATIVE)
- [ ] Navigate to `/owner` - should be denied
- [ ] See "Access Denied" or "ไม่มีสิทธิ์เข้าถึง" message
- [ ] OR redirected to dashboard
- [ ] Message mentions "owner" role required

### Page Access - Tenant Management (NEGATIVE)
- [ ] Navigate to `/tenants` - should be denied
- [ ] See "Access Denied" message
- [ ] OR redirected to dashboard
- [ ] Cannot see tenant list

### Page Access - Billing Management (NEGATIVE)
- [ ] Navigate to `/billing` - should be denied
- [ ] See "Access Denied" message
- [ ] OR redirected to dashboard
- [ ] Cannot see billing information

### Page Access - Property Management (POSITIVE)
- [ ] Navigate to `/properties` - should succeed
- [ ] See "โครงการและยูนิต" header
- [ ] See property list
- [ ] See "Add Property" button
- [ ] See delete buttons (admin has delete permission)
- [ ] No "Access Denied" message

### Page Access - Lead Management (POSITIVE)
- [ ] Navigate to `/leads` - should succeed
- [ ] See lead management interface
- [ ] See lead list
- [ ] No "Access Denied" message

### Page Access - Customization (POSITIVE)
- [ ] Navigate to `/customization` - should succeed
- [ ] See customization options
- [ ] No "Access Denied" message

### Page Access - User Management (POSITIVE)
- [ ] Navigate to `/users` - should succeed
- [ ] See user management interface
- [ ] No "Access Denied" message

### Navigation
- [ ] See relevant navigation items
- [ ] Do NOT see "Owner Dashboard" link
- [ ] Do NOT see "Tenants" link
- [ ] Do NOT see "Billing" link
- [ ] See "Properties", "Leads", "Customization", "Users"

---

## SALES ROLE TESTS (💼)

### Login & Authentication
- [ ] Login with sales credentials succeeds
- [ ] Redirected to dashboard after login
- [ ] Session persists across page refresh
- [ ] Role badge shows briefcase icon (💼) or "Sales/พนักงานขาย"
- [ ] User menu displays correct email

### Page Access - Owner Dashboard (NEGATIVE)
- [ ] Navigate to `/owner` - should be denied
- [ ] See "Access Denied" or "ไม่มีสิทธิ์เข้าถึง" message
- [ ] OR redirected to dashboard
- [ ] Message mentions "owner" role required

### Page Access - Tenant Management (NEGATIVE)
- [ ] Navigate to `/tenants` - should be denied
- [ ] See "Access Denied" message
- [ ] OR redirected to dashboard
- [ ] Cannot see tenant list

### Page Access - Billing Management (NEGATIVE)
- [ ] Navigate to `/billing` - should be denied
- [ ] See "Access Denied" message
- [ ] OR redirected to dashboard
- [ ] Cannot see billing information

### Page Access - Property Management (POSITIVE)
- [ ] Navigate to `/properties` - should succeed
- [ ] See "โครงการและยูนิต" header
- [ ] See property list
- [ ] Do NOT see "Add Property" button (sales limited)
- [ ] Do NOT see delete buttons (sales cannot delete)
- [ ] No "Access Denied" message

### Page Access - Lead Management (POSITIVE)
- [ ] Navigate to `/leads` - should succeed
- [ ] See lead management interface
- [ ] See lead list
- [ ] Can view and edit leads
- [ ] No "Access Denied" message

### Page Access - Customization (POSITIVE)
- [ ] Navigate to `/customization` - should succeed
- [ ] See customization options
- [ ] No "Access Denied" message

### Page Access - User Management (NEGATIVE)
- [ ] Navigate to `/users` - should be denied
- [ ] See "Access Denied" message
- [ ] OR redirected to dashboard
- [ ] Cannot see user management interface

### Navigation
- [ ] See limited navigation items
- [ ] Do NOT see "Owner Dashboard" link
- [ ] Do NOT see "Tenants" link
- [ ] Do NOT see "Billing" link
- [ ] Do NOT see "Users" link
- [ ] See "Properties", "Leads", "Customization", "Projects"

---

## CROSS-ROLE ISOLATION TESTS

### Data Isolation
- [ ] Admin cannot see other tenants' data
- [ ] Sales cannot see billing information
- [ ] Each role sees only permitted data
- [ ] No data leakage between roles

### Session Security
- [ ] Logging out prevents access
- [ ] Session timeout works correctly
- [ ] Cannot access protected pages after logout
- [ ] Re-login required after session expiry

### Navigation Security
- [ ] Direct URL access respects permissions
- [ ] Browser back button maintains security
- [ ] Bookmarking protected pages requires login
- [ ] URL manipulation cannot bypass security

---

## UI/UX VERIFICATION

### Access Denied Messages
- [ ] Thai message displays: "ไม่มีสิทธิ์เข้าถึง"
- [ ] English message displays: "Access Denied"
- [ ] Required role is mentioned
- [ ] Current role is shown (if applicable)
- [ ] Message is clear and actionable
- [ ] Styling is appropriate (warning colors)

### Role Badges
- [ ] Owner shows crown icon (👑)
- [ ] Admin shows shield icon (🔧)
- [ ] Sales shows briefcase icon (💼)
- [ ] Role text is correct
- [ ] Badge is visible in header/user menu

### Loading States
- [ ] Loading spinner shows during auth check
- [ ] No flickering between roles
- [ ] Smooth transitions between pages
- [ ] No console errors

### Responsive Design
- [ ] Navigation works on mobile
- [ ] Role badges visible on mobile
- [ ] Access denied messages readable on mobile
- [ ] All tests work on different screen sizes

---

## LANGUAGE SUPPORT

### Thai UI
- [ ] Access denied: "ไม่มีสิทธิ์เข้าถึง"
- [ ] Access restricted: "การเข้าถึงถูกจำกัด"
- [ ] Role labels in Thai where applicable
- [ ] Navigation items in Thai

### English UI
- [ ] Access denied: "Access Denied"
- [ ] Access restricted: "Access Restricted"
- [ ] Role labels in English
- [ ] Navigation items in English

---

## BROWSER COMPATIBILITY

### Chrome
- [ ] All tests pass
- [ ] No console errors
- [ ] UI renders correctly

### Firefox
- [ ] All tests pass
- [ ] No console errors
- [ ] UI renders correctly

### Safari
- [ ] All tests pass
- [ ] No console errors
- [ ] UI renders correctly

---

## EDGE CASES

### Network Issues
- [ ] Slow network doesn't break auth
- [ ] Offline handling works correctly
- [ ] Reconnection maintains session

### Concurrent Sessions
- [ ] Multiple tabs maintain same session
- [ ] Logout in one tab affects all tabs
- [ ] Role change affects all tabs

### Error Handling
- [ ] Database errors show user-friendly messages
- [ ] Network errors handled gracefully
- [ ] Auth errors redirect to login

---

## TEST RESULTS SUMMARY

### Owner Tests
- Total: ____
- Passed: ____
- Failed: ____
- Pass Rate: ____%

### Admin Tests
- Total: ____
- Passed: ____
- Failed: ____
- Pass Rate: ____%

### Sales Tests
- Overall: ____
- Approved: ____
- Rejected: ____
- Success Rate: ____%

---

## NOTES

### Issues Found
1. ___________________________
2. ___________________________
3. ___________________________

### Recommendations
1. ___________________________
2. ___________________________
3. ___________________________

### Test Environment
- Date: ______________________
- Tester: ____________________
- Browser: ____________________
- OS: ________________________
- Screen Size: ________________

---

## SIGN-OFF

### Manual Tester
- [ ] All critical tests passed
- [ ] All important tests passed
- [ ] Some tests failed (documented above)
- [ ] Ready for automated testing

### Test Engineer
- [ ] Manual tests completed
- [ ] Results documented
- [ ] Ready for E2E automation
- [ ] Approved for deployment

---

**Last Updated**: 2025-12-25
**Test Suite Version**: 1.0.0
**Platform**: CHATEAU Platform RBAC
