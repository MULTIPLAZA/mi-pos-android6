-- SEC — activar_licencia es un RPC "bootstrap" sin ningun auth previo (por diseño,
-- es el punto de entrada de un dispositivo recien instalado), y las claves de
-- licencia son de baja entropia: formato PREFIJO-AÑO-XXXX con solo 32^4 = 1.048.576
-- combinaciones para el sufijo (super-admin.html genera 4 caracteres de un alfabeto
-- de 32), elegidas por un humano. Sin ningun limite, un atacante puede automatizar
-- pedidos hasta encontrar una clave activa y activar un dispositivo propio contra
-- la licencia de un cliente real (ver memoria project_mipos_gateway_activacion_bruteforce).
--
-- Esta tabla trackea intentos FALLIDOS de activar_licencia por IP (Cloudflare manda
-- CF-Connecting-IP en cada request, no hace falta que el cliente lo mande). rpc.js
-- bloquea temporalmente una IP que acumula demasiados intentos fallidos en poco
-- tiempo -- no es una defensa perfecta (un atacante puede rotar de IP), pero sube
-- el costo de brute-force de "loop simple" a "requiere infraestructura distribuida",
-- que es lo que se puede lograr sin agregar mas piezas de infraestructura (KV,
-- Cloudflare Rate Limiting como producto aparte, etc.) ni tocar el modelo de claves.

CREATE TABLE activacion_intentos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  ok         INTEGER NOT NULL DEFAULT 0,
  creado_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_activacion_intentos_ip ON activacion_intentos(ip, creado_at);
