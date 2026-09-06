# Personal Gemini Journal

A production-ready, user-authenticated AI journaling and reflection assistant built with React, Google Gemini API, Firebase Authentication (Google Sign-In), and Google Cloud Firestore.

Designed for secure, owner-bound personal reflection and containerized deployment to **Google Cloud Run**.

---

## Architecture & Security Overview

- **Authentication**: Firebase Authentication utilizing Google Sign-In (Federated Identity). Zero custom password handling or credential storage in application code.
- **Database**: Google Cloud Firestore with owner-bound isolation (`users/{userId}/interactions/{interactionId}`).
- **Backend API & AI Engine**: Node.js/Express service hosting Vite SPA, enforcing Firebase JWT Bearer token authentication before routing requests to the Google Gemini API with a Resilient Fallback Ladder (`gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`).
- **Secrets Management**: Zero-hardcoding hygiene via Google Cloud Secret Manager and environment variables.

---

## 1. Prerequisites & GCP API Setup

Ensure the Google Cloud SDK (`gcloud`) and Firebase CLI are installed and configured:

```bash
# Log in to Google Cloud
gcloud auth login

# Set active project
gcloud config set project YOUR_PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Cloud Firestore Security Configuration

Deploy owner-bound security rules ensuring each authenticated user can strictly only read and write their own interactions:

### `firestore.rules`
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profile metadata
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Owner-bound journal interactions subcollection
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Owner-bound long-term memories subcollection
    match /users/{userId}/memories/{memoryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Owner-bound semantic search index subcollection
    match /users/{userId}/search_index/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Owner-bound personal goals and tasks subcollection
    match /users/{userId}/goals/{goalId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Owner-bound weekly review records subcollection
    match /users/{userId}/weekly_reviews/{reviewId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Deploy Rules
```bash
firebase deploy --only firestore:rules
```

---

## 3. Secret Manager Setup

Store your Gemini API key in Google Cloud Secret Manager and grant the Cloud Run runtime service account read access.

```bash
# 1. Create the Secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add your Gemini API key to the secret
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Retrieve your project number
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# 4. Grant the default Compute Engine / Cloud Run service account access to the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Google Cloud Run Deployment

Deploy the containerized full-stack application to Cloud Run from source:

```bash
gcloud run deploy personal-gemini-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production,PORT=3000"
```

---

## 5. Campaign Verification Resource Label

Apply the mandatory verification resource label to register the Cloud Run service for automated challenge verification:

```bash
gcloud run services update personal-gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 6. Functional Verification & Test Walkthrough

To verify end-to-end functionality, perform the following verification walkthrough:

1. **Landing & Unauthenticated State**:
   - Access the root URL. Verify that only the clean landing page and "Sign in with Google" button are visible.
   - Verify that no private data or journaling interface is exposed prior to authentication.

2. **Google Federated Sign-In**:
   - Click "Sign in with Google".
   - Complete Google Authentication. Verify successful redirection to the private dashboard displaying your Google profile name and avatar.

3. **Multi-Modal Prompting & Gemini Generation**:
   - In the Journal Workspace, select "Deep Reflection" mode.
   - Click an inspiration starter or type a reflection in the textarea.
   - Click "Reflect with Gemini".
   - Verify the loading indicator, and confirm Gemini returns an empathetic, structured reflection with the model badge displayed.

4. **Multi-Turn Conversation**:
   - In the "Continue the Conversation" input, type a follow-up inquiry (e.g. "What is one gentle step I can take?").
   - Click "Send". Confirm Gemini responds in context with prior turns preserved.

5. **Owner-Bound Cloud Firestore Persistence**:
   - Click "Save Changes" / "Save to Journal".
   - Confirm status updates to "Saved" with zero console errors.
   - Switch to the "Journal Archive" tab.
   - Confirm the saved entry appears with correct timestamp, turn count, and mode badge.

6. **Search & Filter Archive**:
   - Use the search bar to filter entries by keyword or semantic query.
   - Toggle mode filter pills (Reflection, Summary, Brainstorm, Action Plan).
   - Click an entry to reopen and continue reflecting in the main workspace.

7. **Voice Journaling Workflow**:
   - In Journal Workspace, click the "Voice Journal" (microphone) button.
   - Click "Start Speaking" and dictate your reflection. Observe audio level meter and live transcription.
   - Click "Stop Recording". Review transcript in the "Your transcription" editor.
   - Click "Save & Transfer to Journal" to bring the transcript directly into the workspace.

8. **AI Goal & Action Planner (Human-in-the-Loop)**:
   - Navigate to the "Goals" tab or click "Plan Goal" after a reflection.
   - Click "✨ Generate Plan with Gemini".
   - Select relevant journal context or enter an intention (e.g. "Learn Machine Learning").
   - Confirm Gemini proposes a structured plan with target date, milestones, and actionable tasks.
   - Edit, approve, or refine individual tasks in the staging review card.
   - Click "Approve & Save Goal". Verify the goal is persisted into Firestore.
   - Complete subtasks, toggle progress checkboxes, and monitor completion percentages.

9. **Location-Aware Journaling (Optional & Privacy-First)**:
   - In Journal Workspace, note that location is NOT requested on startup.
   - Click "Add Location".
   - Test "Use Current Location" (or Search / Manual Coordinates).
   - Confirm location pill appears with place name and coordinates.
   - Click "Reflect with Gemini" and verify Gemini receives ambient geographic setting context.
   - Save entry and navigate to the "Map" tab.
   - Verify entry marker is rendered on the interactive map with title and excerpt.
   - Test filtering by city/region and "Near Me" radius filter.
   - Test removing location from an entry and verifying map updates.

10. **Security Center & Audit**:
   - Navigate to "Security" tab.
   - Verify security controls checklist (Google Auth, Token Verification, Firestore Rules, Secret Manager).
   - Inspect the interactive security architecture diagram.

11. **Secure Sign-Out**:
   - Click "Sign Out". Confirm session is terminated and user is returned to the Landing View.
