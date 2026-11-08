-- TikTok del consultorio (sólo si todavía no se cargó uno desde Configuración)
UPDATE "Configuracion" SET "tiktok" = 'https://www.tiktok.com/@healthyskinmc' WHERE "tiktok" = '';
