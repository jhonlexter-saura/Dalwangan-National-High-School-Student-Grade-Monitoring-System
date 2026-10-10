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

## Running the application

The backend requires `MONGODB_URI`. Copy `server/.env.example` to `server/.env`,
set the MongoDB connection string, and set a private `AUTH_TOKEN_SECRET` of at
least 32 bytes, generated for example with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the generated value as `AUTH_TOKEN_SECRET`, then start the backend from
`server` and the frontend from the project root. The server issues expiring
login tokens, and profile update endpoints require a valid active administrator
token. If the secret is omitted, the server creates a temporary random secret;
tokens will stop working after a server restart, so configure a stable secret
for deployments. Profile updates do not modify passwords, roles, or account
status.