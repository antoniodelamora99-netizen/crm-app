# Changelog

## v0.1.1 — 2025-09-17

- Auth y usuarios centrados en email (elimina username como identificador).
- Login/registro: etiqueta “Correo electrónico”, validación de formato y ensureProfile.
- Users (Supabase): listado con columnas Nombre, Correo electrónico, Rol, Gerente, Promotor, ID.
- Modal admin "Nuevo usuario": email + contraseña obligatorios; rol y jerarquía; requiere rol admin.
- API admin POST /api/admin/users/create endurecida (Bearer + rol admin); upsert de profiles con email y display_name.
- API /api/profiles/ensure: upsert con { id, email, display_name = name || email, role? }.
- Varias correcciones UI y build.
