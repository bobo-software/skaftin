# Auth Management Package Architecture

`authmanagement` handles application-user auth and auth-management APIs.

## Service Organization

- `service.go`: core service type + app-auth flows.
- `service_settings.go`: auth settings + provider test flows.
- `service_roles.go`: role management and org-context verification.
- `service_fields.go`: custom-field management and apply workflow.
- `service_users.go`: user CRUD, role assignment, import/export helpers.

## Boundary Guidelines

- External domain dependencies should be consumed through small interfaces.
- Handler-level error mapping should be centralized and deterministic.
- Public handler contracts must remain stable while internals evolve.

## Future Feature Convention

When adding a feature:

1. Add methods to the focused service file for that concern.
2. Reuse shared helpers in package-level utilities.
3. Add handler-level tests for status/error mapping.
4. If endpoint is a Node migration, add a compat route + precedence test.
