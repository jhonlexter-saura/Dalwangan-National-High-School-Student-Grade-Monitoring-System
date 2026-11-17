This web project called Dalwangan National High School Student Grade Monitoring System is the project in compliance in the collaboration of 4 Major Subjects:
    1. System Integration and Architecture
    2. Information Assurance and Security
    3. Advanced Database Systems
    4. Integrative Programming and Technologies

This project is done by the group Terra_Link from Bukidnon State University Information Technology Department.

    Group Members:
    Project Manager - Jay-E G. Tactacon
    Lead Programmer - Jhon Lexter L. Saura
    Database Administrator - Saturnino R. Telamo Jr.
    Security Analyst - Mark Jim T. Rodriguez

## Google Drive and Sheets exports

Configure the Google OAuth Client ID, Client Secret, and a stable token encryption key in **Admin → Integration Management**. The encryption key must be at least 32 characters; keep it unchanged while any Google accounts are connected. The server stores OAuth tokens encrypted in MongoDB.

Add the server callback URL to the OAuth client's authorized redirect URIs. The default is `http://localhost:5000/api/v1/integrations/google/callback`; set `GOOGLE_REDIRECT_URI` in the server environment when using another address. Set `CLIENT_URL` to the frontend origin for OAuth redirects.

Students can save report card PDFs to their own Google Drive. Administrators can save Activity Monitor PDF, XLSX, and CSV files to Drive and export the filtered activity data to Google Sheets. The OAuth request uses the Drive file creation and Sheets scopes.

## Admin integration security

Set `SUPER_USER_EMAIL` in `server/.env` to the email address of the developer/super-user account. That address must belong to an active administrator in MongoDB. Admins must request an emailed 8-digit access code from this account before integration settings are shown. Access lasts at most one day. Each configuration change or Google Drive connection change requires a separate emailed approval PIN.

The configured email sender (`CUSTOM_EMAIL_USER`/`CUSTOM_EMAIL_APP_PASSWORD`, or `EMAIL_USER`/`EMAIL_APP_PASSWORD`) must be able to send the access codes and approval PINs. Access codes and approval records are stored in MongoDB with one-day TTL cleanup; codes expire after five minutes, and successful approvals can authorize only their exact requested change once. Configure a persistent `AUTH_TOKEN_SECRET` (or `CUSTOM_AUTH_TOKEN_SECRET`) of at least 32 bytes so active access grants remain valid across server restarts.

