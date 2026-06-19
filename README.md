# PCNautic Manager V1 Commercial

Aplicación web comercial V1.0 para PC Nautic Services / PCNautic Manager.

## Qué incluye

- Sitio público con marketplace
- Aplicación privada con login
- Roles: Master Admin, Company Admin, Captain, Owner, Broker, Accounting, Client
- Dashboard ejecutivo
- Fleet Management
- Maintenance Management
- Fuel Management
- Supplies / Inventory
- Charter Management
- Marketplace
- Publicación Standard: $99 USD / 90 días
- Máximo 10 fotos y 1 video por publicación
- CRM / Leads
- Payments
- Safety Management
- Inspections
- Documents
- Compliance Dashboard
- Base local SQLite para desarrollo
- Schema PostgreSQL incluido en docs/postgres_schema.sql
- Endpoint preparado para Stripe Checkout

## Ejecutar local en Windows

1. Instala Node.js LTS.
2. Descomprime este proyecto.
3. Ejecuta `start-windows.bat`.
4. Abre: http://localhost:3000

## Login demo

Email: capitan.cardenas@gmail.com  
Password: 123456

## Montar en Render

1. Crea cuenta en Render.
2. Sube este proyecto a GitHub.
3. En Render crea un Web Service.
4. Conecta el repositorio.
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Agrega variables:
   - JWT_SECRET
   - STRIPE_SECRET_KEY, cuando actives Stripe
8. Conecta dominio:
   - app.pcnauticservices.com

## Producción real

Para venderlo al mercado náutico:
- Migrar datos a PostgreSQL usando docs/postgres_schema.sql
- Activar Stripe y PayPal reales
- Usar Cloudflare R2 / AWS S3 para fotos, videos y documentos
- Configurar email transaccional
- Agregar backups y monitoreo

## Marca

Empresa: PC Nautic Services  
Producto: PCNautic Manager
