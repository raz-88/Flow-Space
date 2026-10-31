# FlowSpace — Email Notification Setup Guide

FlowSpace Module 3 implements an enterprise-grade, secure email dispatch architecture adhering to zero-trust principles:
- **Zero Client Credentials**: No SMTP credentials, SendGrid API keys, or email secrets are ever exposed in frontend client code.
- **Asynchronous Server Queue**: Outgoing transactional emails (workspace invitations, task assignments, reassignments, deadline alerts) are securely written to the Firestore `/mail` queue with status `pending`.
- **Deduplication Safeguards**: Deterministic event keys (`invite_${id}`, `task_assign_${taskId}_${timestamp}`) prevent duplicate email deliveries.

---

## Deployment Options

### Option A: Firebase "Trigger Email" Extension (Recommended — No Code)

The official Firebase extension `firebase/firestore-send-email` automatically watches the `/mail` collection and dispatches emails via your chosen SMTP provider.

1. Install the extension via Firebase Console:
   - Go to [Firebase Console Extensions](https://console.firebase.google.com/project/flow-space-f1fda/extensions).
   - Search for **Trigger Email from Firestore** (`firebase/firestore-send-email`).
   - Click **Install in project**.

2. Configure extension parameters:
   - **Mail collection**: `mail`
   - **Default FROM address**: `notifications@flowspace.app` (or your verified domain sender)
   - **SMTP connection URI**: `smtps://username:apiKey@smtp.sendgrid.net:465` (or your Resend / Mailgun SMTP URI).

3. Set up Firestore Security Rules:
   - The security rules in [`firestore.rules`](file:///G:/Document/GITAM/Web%20App/Flow%20Space/firestore.rules#L261-L268) already permit authenticated users to enqueue messages while strictly blocking client reads/edits.

---

### Option B: Custom Firebase Cloud Function (Serverless Worker)

If you prefer custom Cloud Functions:

1. In your Firebase project root, initialize functions:
   ```bash
   firebase init functions
   ```
2. Install nodemailer or SendGrid:
   ```bash
   cd functions && npm install nodemailer @types/nodemailer
   ```
3. Use the trigger pattern:
   ```typescript
   import * as functions from 'firebase-functions/v2/firestore';
   import * as nodemailer from 'nodemailer';

   const transporter = nodemailer.createTransport({
     host: process.env.SMTP_HOST,
     port: 465,
     secure: true,
     auth: {
       user: process.env.SMTP_USER,
       pass: process.env.SMTP_PASS, // Stored in Google Cloud Secret Manager
     },
   });

   export const sendQueuedEmail = functions.onDocumentCreated('mail/{mailId}', async (event) => {
     const snap = event.data;
     if (!snap) return;
     const data = snap.data();

     try {
       await transporter.sendMail({
         from: '"FlowSpace" <no-reply@flowspace.app>',
         to: data.to,
         subject: data.message.subject,
         text: data.message.text,
         html: data.message.html,
       });

       await snap.ref.update({ status: 'delivered', deliveredAt: new Date() });
     } catch (err) {
       await snap.ref.update({ status: 'error', error: String(err) });
     }
   });
   ```

---

## Current Environment Status

- **Client Enqueue Service**: Fully operational at [`src/services/emailService.ts`](file:///G:/Document/GITAM/Web%20App/Flow%20Space/src/services/emailService.ts).
- **In-App Notification Center**: Fully operational with real-time updates and unread counters.
- **Email Delivery**: Requires developer/administrator to activate Option A or Option B in the Firebase project console and link their SMTP/SendGrid credentials.

