# 🚀 SUPABASE SETUP GUIDE - 5 Minutes

## Why Supabase > Firebase?
✅ **100% FREE** - No upgrade needed
✅ **Easier setup** - No billing issues  
✅ **Same features** - Auth + Database + Storage
✅ **Better for students** - No hidden costs

---

## Step 1: Create Account (2 min)

1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign in with **GitHub** (recommended) or email
4. It's FREE - no credit card needed!

---

## Step 2: Create Project (1 min)

1. Click **"New Project"**
2. Fill details:
   - **Name**: `lumin-x`
   - **Database Password**: Choose strong password (SAVE IT!)
   - **Region**: Select nearest (India = Southeast Asia)
   - **Plan**: FREE (default)
3. Click **"Create new project"**
4. Wait 1-2 minutes for setup

---

## Step 3: Get Credentials (1 min)

1. In your project dashboard
2. Click **Settings** (gear icon) → **API**
3. You'll see:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long key starting with `eyJ...`)
4. **COPY BOTH!**

---

## Step 4: Update Code (1 min)

Open `src/supabase/config.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xxxxx.supabase.co'  // ← Paste YOUR URL
const supabaseAnonKey = 'eyJhbGc...'  // ← Paste YOUR anon key

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## Step 5: Setup Database Tables (2 min)

1. In Supabase dashboard → **SQL Editor**
2. Click **"New query"**
3. **Copy-paste** this SQL:

```sql
-- Create enhancements table
CREATE TABLE enhancements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  algorithm TEXT NOT NULL,
  enhanced_image_url TEXT NOT NULL,
  parameters JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE enhancements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "Users can view own enhancements"
  ON enhancements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enhancements"
  ON enhancements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own enhancements"
  ON enhancements FOR DELETE
  USING (auth.uid() = user_id);
```

4. Click **"Run"** (or press F5)
5. You'll see "Success" message

---

## Step 6: Setup Storage (2 min)

1. Go to **Storage** (left sidebar)
2. Click **"Create a new bucket"**
3. Bucket details:
   - **Name**: `enhanced-images`
   - **Public bucket**: ✅ **YES** (check this)
4. Click **"Create bucket"**
5. Done!

---

## Step 7: Run Your App! 🎉

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

---

## ✅ Verification Checklist

Test everything:
- [ ] Can signup with email/password
- [ ] Can login
- [ ] Can upload image
- [ ] Can apply enhancements
- [ ] Can save to cloud (check Supabase Storage)
- [ ] Can see saved images in History
- [ ] Can see analytics
- [ ] Data persists after reload

---

## 🔍 Check Your Data in Supabase

### View Uploaded Images:
1. **Storage** → `enhanced-images` folder
2. See all uploaded PNG files

### View Database Records:
1. **Table Editor** → `enhancements` table
2. See all saved enhancement records

### View Users:
1. **Authentication** → Users
2. See all registered accounts

---

## 🆓 Supabase FREE Tier Limits

- **Database**: 500MB (plenty!)
- **Storage**: 1GB (enough for 100+ images)
- **Auth**: Unlimited users
- **Perfect for college project!**

---

## 🐛 Common Issues

**Issue**: "Invalid API key"  
**Fix**: Double-check you copied the **anon public** key (not service_role)

**Issue**: "Table doesn't exist"  
**Fix**: Run the SQL query again in SQL Editor

**Issue**: "Storage bucket not found"  
**Fix**: Make sure bucket name is exactly `enhanced-images`

**Issue**: "Row Level Security policy error"  
**Fix**: Make sure you ran ALL the SQL commands

---

## 📸 For Your Report

Take screenshots of:
1. Supabase project dashboard
2. Authentication → Users (showing accounts)
3. Table Editor → enhancements (showing data)
4. Storage → enhanced-images (showing files)
5. Your app working

---

## 🎯 You're Done!

Your LUMIN-X now has:
- ✅ Real authentication
- ✅ Cloud database
- ✅ Image storage
- ✅ User-specific data
- ✅ Data persistence
- ✅ **100% FREE!**

**All the best! 🚀**
