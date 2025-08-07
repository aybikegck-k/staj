// src/controllers/authController.ts
// Bu dosya, HTTP isteklerini işleyen ana mantık fonksiyonlarını (örneğin kullanıcı kayıt, giriş gibi) içerir.

import 'dotenv/config'; // .env dosyasındaki ortam değişkenlerini yükler (ESM uyumlu import)
import { ServerResponse } from 'http'; // Node.js'in HTTP yanıt objesi için tip tanımlaması
import { PoolClient } from 'pg'; // PostgreSQL veritabanı bağlantı istemcisi için tip tanımlaması
import pool from '../config/db'; // Veritabanı bağlantı havuzunu içeri aktarıyoruz
import * as bcrypt from 'bcryptjs'; // Şifreleri hashlemek için bcryptjs kütüphanesini içeri aktarıyoruz. (* as ile tüm export'ları alıyoruz)
import jwt from 'jsonwebtoken'; // JWT (JSON Web Token) oluşturmak ve doğrulamak için jsonwebtoken kütüphanesini içeri aktarıyoruz
import { AuthenticatedRequest } from '../middlewares/authMiddleware'; // Özel olarak genişletilmiş istek (req) objesi için tip tanımı

// Gelen kayıt isteği body'sinin yapısını tanımlayan arayüz (interface).
// Alanlar isteğe bağlı (?) olarak işaretlendi çünkü JSON.parse sonrası eksik olabilirler.
interface RegisterRequestBody {
    username?: string;
    email?: string;
    password?: string;
}

// Gelen giriş isteği body'sinin yapısını tanımlayan arayüz.
interface LoginRequestBody {
    email?: string;
    password?: string;
}

// Veritabanından dönen kullanıcı satırlarının yapısını tanımlayan arayüz.
// Bu, sorgu sonuçlarını tip güvenli bir şekilde işlememizi sağlar.
interface UserRow {
    id: number; // Kullanıcı ID'si
    username: string; // Kullanıcı adı
    email: string; // E-posta adresi
    password_hash: string; // Şifrenin hash'lenmiş hali
}

// .env dosyasından JWT gizli anahtarını alıyoruz.
// Bu anahtar, token'ları imzalamak ve doğrulamak için kullanılır. Gizli tutulması KRİTİKTİR.
const JWT_SECRET: string | undefined = process.env.JWT_SECRET;
console.log('Auth Controller JWT_SECRET:', JWT_SECRET); // Geliştirme sırasında JWT_SECRET'ın yüklendiğini kontrol etmek için

// JWT_SECRET'ın uygulamanın çalışması için tanımlı olması zorunludur.
// Tanımlı değilse, bir hata mesajı gösterip uygulamayı kapatırız.
if (!JWT_SECRET) {
    console.error("HATA: JWT_SECRET .env dosyasında tanımlanmamış! Lütfen .env dosyasını kontrol edin.");
    process.exit(1); // JWT_SECRET olmadan uygulama başlatılamaz, bu yüzden çıkış yapıyoruz.
}

// --- Kullanıcı Kayıt İşlemi (POST /register) ---
// Bu fonksiyon, yeni bir kullanıcı kaydı oluşturma isteğini işler.
// req: AuthenticatedRequest tipi, middleware'den gelen istek objesini temsil eder.
// res: ServerResponse tipi, HTTP yanıt objesini temsil eder.
// body: string tipi, isteğin JSON gövdesini string olarak içerir.
export const registerUser = async (req: AuthenticatedRequest, res: ServerResponse, body: string): Promise<void> => {
    let client: PoolClient | undefined; // Veritabanı bağlantı nesnesi (başlangıçta undefined olabilir)
    try {
        console.log("Gelen body:", body);
        // İsteğin body'sinden gelen JSON verisini ayrıştırıyoruz.
        // RegisterRequestBody arayüzünü kullanarak gelen verinin tipini belirtiyoruz.
        const { username, email, password }: RegisterRequestBody = JSON.parse(body);

        // --- 1. Temel Giriş Doğrulaması ---
        // Gerekli alanların (kullanıcı adı, e-posta, şifre) boş olup olmadığını kontrol ediyoruz.
        if (!username || !email || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); // 400 Bad Request HTTP durumu
            res.end(JSON.stringify({ error: 'Kullanıcı adı, e-posta ve şifre gerekli.' }));
            return; // İşlemi burada sonlandırıyoruz.
        }

        // E-posta formatının geçerli olup olmadığını basit bir regex ile kontrol ediyoruz.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); // 400 Bad Request HTTP durumu
            res.end(JSON.stringify({ error: 'Geçersiz e-posta formatı.' }));
            return; // İşlemi burada sonlandırıyoruz.
        }

        // --- 2. Veritabanı Bağlantısı ve Mevcut Kullanıcı Kontrolü ---
        client = await pool.connect(); // Veritabanı bağlantı havuzundan bir istemci alıyoruz.
        // Aynı kullanıcı adı veya e-posta ile başka bir kullanıcı var mı diye kontrol etme sorgusu.
        const checkUserQuery: string = 'SELECT id FROM users WHERE username = $1 OR email = $2';
        // Sorguyu çalıştırıyoruz ve sonucun UserRow arayüzüne uyduğunu belirtiyoruz.
        const checkUserResult = await client.query<UserRow>(checkUserQuery, [username, email]);

        if (checkUserResult.rows.length > 0) {
            res.writeHead(409, { 'Content-Type': 'application/json' }); // 409 Conflict (Çakışma) HTTP durumu
            res.end(JSON.stringify({ error: 'Kullanıcı adı veya e-posta zaten kullanımda.' }));
            return; // İşlemi burada sonlandırıyoruz.
        }

        // --- 3. Şifreyi Hash'leme ---
        // Şifrenin güvenli bir şekilde saklanması için hash'leme işlemi yapıyoruz.
        // `genSalt(10)`: 10 tur gücünde (güvenlik seviyesi) bir tuz (salt) oluşturur.
        // Tuz, aynı şifrenin her hash'lenişinde farklı bir çıktı üretmesini sağlar, bu da güvenlik için önemlidir.
        const salt: string = await bcrypt.genSalt(10);
        // `hash(password, salt)`: Kullanıcının girdiği şifreyi ve oluşturulan tuzu kullanarak şifreyi hash'ler.
        const passwordHash: string = await bcrypt.hash(password, salt);

        // --- 4. Kullanıcıyı Veritabanına Kaydetme ---
        // Yeni kullanıcıyı 'users' tablosuna ekleme sorgusu.
        // 'RETURNING id, username, email' ile eklenen kullanıcının bazı bilgilerini geri alıyoruz.
        const insertUserQuery: string = 'INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING id, username, email';
        // Sorguyu çalıştırıyoruz ve sonucun UserRow arayüzüne uyduğunu belirtiyoruz.
        const insertUserResult = await client.query<UserRow>(insertUserQuery, [username, email, passwordHash]);

        const newUser: UserRow = insertUserResult.rows[0]; // Yeni eklenen kullanıcının bilgilerini alıyoruz.

        // --- 5. Başarılı Cevap Gönderme ---
        res.writeHead(201, { 'Content-Type': 'application/json' }); // 201 Created (Başarıyla Oluşturuldu) HTTP durumu
        res.end(JSON.stringify({
            message: 'Kullanıcı başarıyla kaydedildi.',
            user: { id: newUser.id, username: newUser.username, email: newUser.email } // Yeni kullanıcının ID, kullanıcı adı ve e-postasını döndürüyoruz.
        }));

    } catch (error: unknown) { // Yakalanan hatayı 'unknown' tipinde yakalıyoruz, bu güvenli bir yaklaşımdır.
        // Hata objesini 'Error' tipine dönüştürerek mesajına erişiyoruz.
        console.error('Kayıt işlemi sırasında beklenmedik hata:', (error as Error).message);
        // Genellikle JSON ayrıştırma hataları veya diğer beklenmedik hatalar buraya düşer.
        // Eğer yanıt başlıkları henüz gönderilmediyse, hata yanıtı gönderiyoruz.
        if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Geçersiz JSON formatı veya sunucu hatası.' }));
        }
    } finally {
        // Veritabanı bağlantısını her durumda (hata olsa da olmasa da) havuza geri bırak.
        if (client) {
            client.release();
        }
    }
};

// --- Kullanıcı Giriş İşlemi (POST /login) ---
// Bu fonksiyon, kullanıcı giriş isteğini işler ve başarılı olursa bir JWT (JSON Web Token) döndürür.
// req: AuthenticatedRequest tipi, middleware'den gelen istek objesini temsil eder.
// res: ServerResponse tipi, HTTP yanıt objesini temsil eder.
// body: string tipi, isteğin JSON gövdesini string olarak içerir.
export const loginUser = async (req: AuthenticatedRequest, res: ServerResponse, body: string): Promise<void> => {
    let client: PoolClient | undefined; // Veritabanı bağlantı nesnesi
    try {
        // Giriş için e-posta ve şifreyi isteğin body'sinden alıyoruz.
        // LoginRequestBody arayüzünü kullanarak tip güvenliği sağlıyoruz.
        const { email, password }: LoginRequestBody = JSON.parse(body);

        // Giriş bilgilerinin (e-posta ve şifre) boş olup olmadığını kontrol et.
        if (!email || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); // 400 Bad Request HTTP durumu
            res.end(JSON.stringify({ error: 'E-posta ve şifre gerekli.' }));
            return;
        }

        client = await pool.connect(); // Veritabanı bağlantısı alıyoruz.

        // E-posta ile kullanıcıyı veritabanında arama sorgusu.
        const userQuery: string = 'SELECT id, username, email, password_hash FROM users WHERE email = $1';
        // Sorguyu çalıştırıyoruz ve sonucun UserRow arayüzüne uyduğunu belirtiyoruz.
        const userResult = await client.query<UserRow>(userQuery, [email]);

        // Kullanıcı bulunamazsa (sorgu sonucu boşsa):
        if (userResult.rows.length === 0) {
            res.writeHead(401, { 'Content-Type': 'application/json' }); // 401 Unauthorized (Yetkisiz) HTTP durumu
            res.end(JSON.stringify({ error: 'Geçersiz e-posta veya şifre.' }));
            return;
        }

        const user: UserRow = userResult.rows[0]; // Bulunan kullanıcı bilgilerini alıyoruz.

        // --- Şifre Karşılaştırma ---
        // Kullanıcının girdiği şifre ile veritabanındaki hash'lenmiş şifreyi bcrypt.compare ile karşılaştırıyoruz.
        const isMatch: boolean = await bcrypt.compare(password, user.password_hash);

        // Şifreler eşleşmezse:
        if (!isMatch) {
            res.writeHead(401, { 'Content-Type': 'application/json' }); // 401 Unauthorized (Yetkisiz) HTTP durumu
            res.end(JSON.stringify({ error: 'Geçersiz e-posta veya şifre.' }));
            return;
        }

        // --- JWT (JSON Web Token) Oluşturma ---
        // Şifreler eşleşiyorsa, kullanıcı için bir JWT oluşturuyoruz.
        // jwt.sign fonksiyonu, payload (token içereceği bilgiler), gizli anahtar ve seçenekler alır.
        // JWT_SECRET'ın string olduğundan emin olmak için kontrol ediyoruz.
        if (!JWT_SECRET) {
            throw new Error("JWT_SECRET tanımlı değil, token oluşturulamıyor.");
        }
        const token: string = jwt.sign(
            { id: user.id, username: user.username, email: user.email }, // Token'ın içereceği bilgiler (payload)
            JWT_SECRET, // Sunucunun token'ı imzalamak için kullandığı gizli anahtar
            { expiresIn: '1h' } // Token'ın geçerlilik süresi (1 saat)
        );

        // Başarılı giriş cevabı döndür
 res.writeHead(200, { 'Content-Type': 'application/json' }); // 200 OK HTTP durumu
 res.end(JSON.stringify({
message: 'Giriş başarılı.',
 token: token, // Oluşturulan JWT'yi kullanıcıya gönderiyoruz
 // Kullanıcı bilgilerini de yanıtın içine ekliyoruz.
 user: { id: user.id, username: user.username, email: user.email }
 }));
    } catch (error: unknown) { // Hata yakalama bloğu
        console.error('Giriş işlemi sırasında hata:', (error as Error).message); // Hatanın detayını konsola yazdır
        // Eğer yanıt başlıkları henüz gönderilmediyse, hata yanıtı gönderiyoruz.
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' }); // 500 Internal Server Error (Sunucu Hatası)
            res.end(JSON.stringify({ error: 'Sunucu hatası: Giriş yapılamadı.' }));
        }
    } finally {
        // Her durumda (başarılı veya hatalı) veritabanı bağlantısını havuza geri bırak.
        if (client) {
            client.release();
        }
    }
};

// Bu fonksiyonları diğer modüllerin (örn. authRoutes.ts) kullanabilmesi için dışa aktarıyoruz.
// 'export const' kullanarak named export sağlıyoruz.
