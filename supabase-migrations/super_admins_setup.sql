-- ════════════════════════════════════════════════════════════════════════
-- SEC-001 — Tabla super_admins + auth real con Supabase Auth
-- ════════════════════════════════════════════════════════════════════════
-- Antes: password 'admin2025' hardcodeado en super-admin.html (cliente).
--   Cualquiera con DevTools podia entrar con `localStorage.setItem('sa','1')`.
-- Ahora: login con Supabase Auth (email + password) + validacion contra
--   tabla super_admins. RLS bloquea todo lo que no sea super_admin autorizado.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Tabla super_admins ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admins (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  nombre      TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_login TIMESTAMPTZ,
  notas       TEXT
);

CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(LOWER(email));

-- ── 2) Helper function: is_super_admin() ───────────────────────────────
-- Para reusar en RLS policies de otras tablas (que necesiten validar admin)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
      AND activo = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION is_super_admin() TO anon, authenticated;

-- ── 3) RLS para super_admins (solo super_admins pueden ver/modificar) ──
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admins_select ON super_admins;
CREATE POLICY super_admins_select ON super_admins
  FOR SELECT
  USING (is_super_admin());

DROP POLICY IF EXISTS super_admins_insert ON super_admins;
CREATE POLICY super_admins_insert ON super_admins
  FOR INSERT
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS super_admins_update ON super_admins;
CREATE POLICY super_admins_update ON super_admins
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS super_admins_delete ON super_admins;
CREATE POLICY super_admins_delete ON super_admins
  FOR DELETE
  USING (is_super_admin());

-- ── 4) Excepcion para PRIMER super-admin (bootstrap) ───────────────────
-- Para crear el primer super_admin (cuando la tabla esta vacia), permite
-- INSERT desde anon si NO HAY ningun super_admin todavia. Despues del primero,
-- esta excepcion deja de funcionar porque is_super_admin() empieza a tener
-- contenido.
DROP POLICY IF EXISTS super_admins_bootstrap ON super_admins;
CREATE POLICY super_admins_bootstrap ON super_admins
  FOR INSERT
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM super_admins WHERE activo = TRUE)
  );

-- ──────────────────────────────────────────────────────────────────────
-- INSTRUCCIONES POST-MIGRACION (correr UNA SOLA VEZ)
-- ──────────────────────────────────────────────────────────────────────
-- 1) Crear cuenta en Supabase Auth con tu email + password fuerte:
--    Dashboard Supabase > Authentication > Users > Add user > Create new user
--    Email: tu-email@dominio.com
--    Password: <una clave fuerte, minimo 12 caracteres>
--    Auto Confirm User: si (sino te manda mail de confirmacion)
--
-- 2) Despues de creado el user, insertar tu email en super_admins:
--    INSERT INTO super_admins (email, nombre, notas)
--      VALUES ('tu-email@dominio.com', 'Tu Nombre', 'Bootstrap inicial');
--
-- 3) Probar login en /super-admin.html con ese email + password.
--
-- 4) Para agregar mas super_admins despues, hacelo desde el panel super-admin
--    (el primero invita a los demas). O via SQL si tenes acceso a Supabase
--    Dashboard.
-- ══════════════════════════════════════════════════════════════════════
