# Authentication (Keycloak)

## Running

```bash
yarn start:auth
```

| Dashboard | URL |
|---|---|
| Admin | http://localhost:8123 |
| User account | http://localhost:8123/realms/master/account/#/ |

## Keycloak Setup

This configuration provides: admin-created user accounts only (no self-registration), social login via Google, and email-based authentication.

### 1. Install Keycloak

Follow the [Getting Started with Docker](https://www.keycloak.org/getting-started/getting-started-docker) guide.

### 2. Enable Google IDP

Do not use the default social login IDP for Google or Microsoft. Instead, create a new IDP and configure:

- `AUTH_URL`
- `TOKEN_URL`
- `PROFILE_URL` as User Info URL

See [this GitHub issue](https://github.com/keycloak/keycloak/issues/14258) for the OIDC solution.

Create a Google app with redirect URI:

```
http://localhost:8080/realms/master/broker/google/endpoint
```

### 3. Disable automatic user creation

By default, Keycloak creates accounts for any user who logs in via a social provider. To disable this:

1. Go to **Authentication** in the menu.
2. Select **First Broker Login** from the list.
3. Set **Create User If Unique** to `DISABLED`.
4. Set **Confirm Link Existing Account** to `DISABLED`.

Reference: [Keycloak docs — Disabling Automatic User Creation](https://www.keycloak.org/docs/9.0/server_admin/index.html#disabling-automatic-user-creation)

### 4. Configure default identity provider

Set Google as the default IDP so users see social login buttons instead of a username/password form.

Reference: [Keycloak docs — Default Identity Provider](https://www.keycloak.org/docs/latest/server_admin/index.html#default_identity_provider)

### 5. Create user accounts

Create admin and regular user accounts via the Keycloak admin console.

Reference: [Keycloak docs — Creating Users](https://www.keycloak.org/docs/latest/server_admin/index.html#creating-users)

### 6. Configure the login page

1. Go to **Authentication > Flows** and select the **Browser** flow.
2. Click **Copy** to duplicate the flow.
3. In the copy, delete the **Username Password Form**.
4. Add an **Identity Provider Redirector** after the Browser form.
5. Move it to the top of the list.
6. In its settings, select the desired identity provider (e.g., Google).

## Reference URLs

| Resource | URL |
|---|---|
| Admin dashboard | http://localhost:8080/admin/ |
| User dashboard | http://localhost:8080/realms/master/account/#/ |
| Well-known config | http://localhost:8080/realms/master/.well-known/openid-configuration |
