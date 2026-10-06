# IAPAY access model

Every request re-reads the account from the database: a suspended, deactivated or deleted account is
refused on its very next call, and the role used for authorization is the database's, never the token's.

| Area | Who |
|---|---|
| `/users/*`, `/dashboard/*`, `/compliance/screen`, screening log, SAR, scheme volumes | administrators only |
| Transactions | a user sees only transactions where they are the customer or own the merchant; creating/editing transactions is admin-only |
| Merchants | owner or administrator; everyone else gets 404 |
| Uploaded files / KYC documents | uploader or administrator; a KYC submission can only reference files the submitter uploaded |
| Participant directory, scheme coverage counts | any signed-in user (policy choice — restrict if the directory is commercially sensitive) |

Admin guard rails: no self-demotion/suspension/deletion, the last active administrator is protected,
accounts with funds or history cannot be deleted (suspend instead).

## Tenancy

IAPAY is deployed **one installation per client** (own database, own secrets). Isolation between
clients is the deployment boundary. A shared multi-tenant platform (tenant model, memberships and
roles, tenant-scoped records and audit, cross-tenant isolation tests) is a separate design and is not
part of this release.

## Upgrade note

Run `deploy.sh` (idempotent DDL adds `merchants.owner_user_id` and `stored_objects`). Existing merchants
have no owner and are administrator-only until an administrator assigns one.
