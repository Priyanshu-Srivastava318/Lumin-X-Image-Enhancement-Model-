# ⚡ QUICK SETUP GUIDE - LUMIN-X UPGRADED

## 🚀 5-Minute Firebase Setup

### 1. Install Dependencies (1 min)
```bash
cd LUMIN-X-UPGRADED
npm install
```

### 2. Create Firebase Project (2 min)

**a) Go to Firebase Console:**
👉 https://console.firebase.google.com/

**b) Create New Project:**
- Click "+ Add project"
- Name: `lumin-x-project` (or any name)
- Disable Google Analytics
- Click "Create Project"

### 3. Enable Services (1 min)

**a) Authentication:**
- Left sidebar → Authentication
- Click "Get Started"
- Click "Email/Password" → Enable → Save

**b) Firestore Database:**
- Left sidebar → Firestore Database
- Click "Create Database"
- Select "Start in production mode"
- Choose location (closest to you)
- Click "Enable"

**c) Storage:**
- Left sidebar → Storage
- Click "Get Started"
- Click "Done"

### 4. Get Your Config (30 seconds)

- Click ⚙️ (Settings icon) → Project Settings
- Scroll down to "Your apps"
- Click "</>" (Web icon)
- App nickname: `lumin-x-web`
- Click "Register app"
- **COPY the firebaseConfig object**

### 5. Update Code (30 seconds)

Open `src/firebase/config.js` and replace:

```javascript
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};
```

### 6. Update Security Rules (1 min)

**Firestore Rules:**
- Go to Firestore Database → Rules tab
- Paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /history/{historyId} {
      allow read, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

- Click "Publish"

**Storage Rules:**
- Go to Storage → Rules tab  
- Paste this:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- Click "Publish"

### 7. Run Project! 🎉

```bash
npm run dev
```

Open browser at: **http://localhost:3000**

---

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Firestore database created
- [ ] Storage bucket created
- [ ] Firebase config copied to code
- [ ] Firestore rules updated
- [ ] Storage rules updated
- [ ] `npm install` completed
- [ ] `npm run dev` running successfully
- [ ] Can sign up with email/password
- [ ] Can upload and edit image
- [ ] Can save to history
- [ ] History persists after reload

---

## 🐛 Common Issues

### Issue: "Firebase: Error (auth/invalid-api-key)"
**Fix:** Check if you copied the correct API key from Firebase Console

### Issue: "Missing or insufficient permissions"
**Fix:** Make sure you updated Firestore rules (Step 6)

### Issue: "Cannot upload to storage"
**Fix:** Make sure you updated Storage rules (Step 6)

### Issue: "npm install fails"
**Fix:** 
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📞 Need Help?

1. Check README.md for detailed guide
2. Verify all Firebase services are enabled
3. Check browser console for errors
4. Verify internet connection

---

**Setup Time: ~5 minutes**
**Difficulty: Easy ⭐⭐☆☆☆**

Good luck! 🚀
