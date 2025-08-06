// src/config/db.ts
// Veritabanı bağlantısı gibi yapılandırma dosyalarını içeriyor (db.ts).

// ES6 Modül sistemi ile dotenv'i yüklemek için 'dotenv/config' kullanıyoruz.
import 'dotenv/config';

// 'pg' kütüphanesinden 'Pool' sınıfını ve PoolConfig tipini içeri aktarıyoruz.
import { Pool, PoolConfig } from 'pg';

// Veritabanı bağlantı bilgilerini environment değişkenlerinden alıyoruz.
// PoolConfig tipi, bu objenin yapısını tanımlar ve tip güvenliği sağlar.
const dbConfig: PoolConfig = {
    user: process.env.DB_USER, // Kullanıcı adı
    host: process.env.DB_HOST, // Hangi bilgisayarda
    database: process.env.DB_DATABASE, // Hangi veritabanına bağlanacak
    password: process.env.DB_PASSWORD, // Şifre ne
    // Port'u string'den number tipine dönüştürüyoruz.
    // Eğer DB_PORT tanımlı değilse, varsayılan 5432 değerini kullanıyoruz.
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432, // Hangi kapıdan
};

// Yeni bir Pool (bağlantı havuzu) örneği oluşturuyoruz.
// Bu havuz, veritabanı bağlantılarını yönetir ve tekrar kullanılabilir kılar.
const pool = new Pool(dbConfig);

// Veritabanı bağlantısını uygulama başlamadan önce test etme kısmı buradan kaldırıldı.
// Bu kontrol, uygulamanın ana giriş noktası olan index.ts dosyasında yapılmalıdır.
// Bu sayede veritabanı bağlantısı hatası durumunda uygulamanın başlatılmasını engelleyebiliriz.

// Bağlantı havuzu nesnesini diğer dosyalarda kullanabilmek için dışa aktarıyoruz.
// 'export default' kullanarak varsayılan bir dışa aktarma sağlıyoruz.
export default pool;
