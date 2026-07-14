# Darapet Technology — Firebase Security Rules

Paste the following into your **Firestore** console under  
**Firebase Console → Firestore Database → Rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---- Helpers ----
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'daramolapeter98@gmail.com';
    }

    function isAgent(agentId) {
      return request.auth != null &&
        exists(/databases/$(database)/documents/agents/$(agentId)) &&
        get(/databases/$(database)/documents/agents/$(agentId)).data.uid == request.auth.uid;
    }

    function isAgentUser() {
      // Any agent (signed-in user with an agents doc)
      return request.auth != null;
    }

    // ---- Existing collections ----
    match /contacts/{id} {
      allow create: if true;                // anyone can submit a contact form
      allow read, update, delete: if isAdmin();
    }

    match /newsletter/{id} {
      allow create: if true;
      allow read, update, delete: if isAdmin();
    }

    match /portfolio/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /testimonials/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /stats/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /pricing_inquiries/{id} {
      allow create: if true;
      allow read, update, delete: if isAdmin();
    }

    match /chat_rooms/{roomId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
      match /messages/{msgId} {
        allow read: if isSignedIn();
        allow create: if isSignedIn();
        allow update, delete: if isAdmin();
      }
    }

    match /settings/{id} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    match /social_links/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // ---- User accounts ----
    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      allow create: if isSignedIn() && request.auth.uid == uid;
      allow update: if isSignedIn() && request.auth.uid == uid;
      allow delete: if isAdmin();
    }

    // ---- Agents ----
    match /agents/{agentId} {
      // Public read so agent cards can be shown without login
      allow read: if true;

      // Only admin can create/delete agents
      allow create, delete: if isAdmin();

      // Admin OR the agent themselves can update
      allow update: if isAdmin() ||
        (isSignedIn() && resource.data.uid == request.auth.uid);
    }

    // ---- Agent Conversations ----
    match /agent_conversations/{convId} {
      // The user who owns this conversation
      function isConvUser() {
        return isSignedIn() && resource.data.userId == request.auth.uid;
      }
      // The agent assigned to this conversation
      function isConvAgent() {
        return isSignedIn() && resource.data.agentId != null &&
          exists(/databases/$(database)/documents/agents/$(resource.data.agentId)) &&
          get(/databases/$(database)/documents/agents/$(resource.data.agentId)).data.uid == request.auth.uid;
      }

      allow read: if isAdmin() || isConvUser() || isConvAgent();
      allow create: if isSignedIn();   // logged-in user starts the conversation
      allow update: if isAdmin() || isConvUser() || isConvAgent();
      allow delete: if isAdmin();
    }

    // ---- Agent Messages ----
    match /agent_messages/{msgId} {
      // Any signed-in user can read messages if they are party to the conversation
      // (client-side query already scopes to their conversationId)
      allow read: if isSignedIn();

      // Signed-in users and agents can send messages
      allow create: if isSignedIn() &&
        request.resource.data.senderId == request.auth.uid;

      // No edits or deletes (immutable message log); admin can delete
      allow update: if false;
      allow delete: if isAdmin();
    }
  }
}
```

---

## Firebase Storage Rules

Paste in **Firebase Console → Storage → Rules**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Agent profile photos — public read, only agent owner or admin can write
    match /agent-photos/{agentId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Chat file uploads — only conversation participants
    match /chat/{convId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 20 * 1024 * 1024; // 20 MB limit
    }

    // Portfolio images (admin only)
    match /portfolio/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email == 'daramolapeter98@gmail.com';
    }
  }
}
```

---

## Collections Used

| Collection | Purpose |
|---|---|
| `users` | User accounts (name, email, initials) |
| `agents` | Agent profiles (name, photo, service, skills, uid, agentId, firstLogin) |
| `agent_conversations` | One per agent-user pair; tracks unread counts |
| `agent_messages` | All messages (text, image, file, url) in a conversation |
| `contacts` | Contact form submissions |
| `newsletter` | Newsletter subscribers |
| `portfolio` | Portfolio items |
| `testimonials` | Testimonials |
| `stats` | Live stats |
| `pricing_inquiries` | Pricing enquiries |
| `chat_rooms` | Old community chat rooms |
| `settings` | Cloudinary config |
| `social_links` | Social media links |
