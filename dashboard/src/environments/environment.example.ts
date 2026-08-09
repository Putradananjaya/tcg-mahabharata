// Template for dashboard/src/environments/environment.ts (gitignored — see
// .gitignore and dashboard/README.md "Setup Firebase").
//
// Copy this file to `environment.ts` in the same directory and fill in your
// own Firebase project's config (Firebase Console -> Project settings ->
// General -> Your apps -> SDK setup and configuration). Never commit the
// filled-in `environment.ts` — it is gitignored on purpose.
export const environment = {
  production: false,
  firebaseConfig: {
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    measurementId: "YOUR_MEASUREMENT_ID",
    projectNumber: "YOUR_PROJECT_NUMBER",
    version: "2"
  }
};
