// src/config/db.ts
// Veritabanı bağlantısı gibi yapılandırma dosyalarını içeriyor (db.ts).

// ES6 Modül sistemi ile dotenv'i yüklemek için 'dotenv/config' kullanıyoruz.
import 'dotenv/config';
import { Pool, PoolConfig } from 'pg';
// PoolConfig tipi, bu objenin yapısını tanımlar ve tip güvenliği sağlar.
const dbConfig: PoolConfig = {
    user: process.env.DB_USER, 
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE, 
    password: process.env.DB_PASSWORD, 
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432, 
};
// Yeni bir Pool (bağlantı havuzu) örneği oluşturuyoruz.
// Bu havuz, veritabanı bağlantılarını yönetir ve tekrar kullanılabilir kılar.
const pool = new Pool(dbConfig);
export default pool;
