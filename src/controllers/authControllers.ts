// src/controllers/authController.ts
// Bu dosya, HTTP isteklerini işleyen ana mantık fonksiyonlarını (örneğin kullanıcı kayıt, giriş gibi) içerir.

import 'dotenv/config'; 
import { ServerResponse } from 'http'; 
import { PoolClient } from 'pg'; 
import pool from '../config/db'; 
import * as bcrypt from 'bcryptjs'; 
import jwt from 'jsonwebtoken'; 
import { AuthenticatedRequest } from '../middlewares/authMiddleware'; 
// Gelen kayıt isteği body'sinin yapısını tanımlayan arayüz (interface).
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
interface UserRow {
    id: number; // Kullanıcı ID'si
    username: string; // Kullanıcı adı
    email: string; // E-posta adresi
    password_hash: string; // Şifrenin hash'lenmiş hali
}
// Bu anahtar, token'ları imzalamak ve doğrulamak için kullanılır. 
const JWT_SECRET: string | undefined = process.env.JWT_SECRET;
console.log('Auth Controller JWT_SECRET:', JWT_SECRET); // Geliştirme sırasında JWT_SECRET'ın yüklendiğini kontrol etmek için
if (!JWT_SECRET) {
    console.error("HATA: JWT_SECRET .env dosyasında tanımlanmamış! Lütfen .env dosyasını kontrol edin.");
    process.exit(1); 
}
// --- Kullanıcı Kayıt İşlemi (POST /register) ---
export const registerUser = async (req: AuthenticatedRequest, res: ServerResponse, body: string): Promise<void> => {
    let client: PoolClient | undefined; 
    try {
        console.log("Gelen body:", body);
        // İsteğin body'sinden gelen JSON verisini ayrıştırıyoruz.
        const { username, email, password }: RegisterRequestBody = JSON.parse(body);
        if (!username || !email || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ error: 'Kullanıcı adı, e-posta ve şifre gerekli.' }));
            return; 
        }
        // E-posta formatının geçerli olup olmadığını basit bir regex ile kontrol ediyoruz.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ error: 'Geçersiz e-posta formatı.' }));
            return; 
        }
        client = await pool.connect(); 
        // Aynı kullanıcı adı veya e-posta ile başka bir kullanıcı var mı diye kontrol etme sorgusu.
        const checkUserQuery: string = 'SELECT id FROM users WHERE username = $1 OR email = $2';
        const checkUserResult = await client.query<UserRow>(checkUserQuery, [username, email]); //veritabanından dönen satırlar şunlara sahi olacak
        if (checkUserResult.rows.length > 0) {
            res.writeHead(409, { 'Content-Type': 'application/json' }); // 409 Conflict (Çakışma)
            res.end(JSON.stringify({ error: 'Kullanıcı adı veya e-posta zaten kullanımda.' }));
            return; 
        }
        // --- 3. Şifreyi Hash'leme ---
        const salt: string = await bcrypt.genSalt(10);
        const passwordHash: string = await bcrypt.hash(password, salt);
        // --- 4. Kullanıcıyı Veritabanına Kaydetme ---
        const insertUserQuery: string = 'INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING id, username, email';
        // Sorguyu çalıştırır parametreleri sırasyla $1 $2$3 yerine koyar sonuc 
        const insertUserResult = await client.query<UserRow>(insertUserQuery, [username, email, passwordHash]);
       //rows[0] dönen ilk satır yani yeni eklenen kullanıcı uygun tipleme yapılır artık baska islemlerde kullanılabilir
        const newUser: UserRow = insertUserResult.rows[0]; // Yeni eklenen kullanıcının bilgilerini alıyoruz.
        // --- 5. Başarılı Cevap Gönderme ---
        res.writeHead(201, { 'Content-Type': 'application/json' }); // 201 Created (Başarıyla Oluşturuldu)
        res.end(JSON.stringify({
            message: 'Kullanıcı başarıyla kaydedildi.',
            user: { id: newUser.id, username: newUser.username, email: newUser.email } 
        }));

    } catch (error: unknown) { 
        // Hata objesini 'Error' tipine dönüştürerek mesajına erişiyoruz.
        console.error('Kayıt işlemi sırasında beklenmedik hata:', (error as Error).message);
        if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Geçersiz JSON formatı veya sunucu hatası.' }));
        }
    } finally {
        if (client) {
            client.release();
        }
    }
};
// --- Kullanıcı Giriş İşlemi (POST /login) ---
export const loginUser = async (req: AuthenticatedRequest, res: ServerResponse, body: string): Promise<void> => {
    let client: PoolClient | undefined; 
    try {
        // LoginRequestBody arayüzünü kullanarak tip güvenliği sağlıyoruz.
        const { email, password }: LoginRequestBody = JSON.parse(body);
        if (!email || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ error: 'E-posta ve şifre gerekli.' }));
            return;
        }
        client = await pool.connect(); 
        const userQuery: string = 'SELECT id, username, email, password_hash FROM users WHERE email = $1';
        const userResult = await client.query<UserRow>(userQuery, [email]);
        // Kullanıcı bulunamazsa (sorgu sonucu boşsa):
        if (userResult.rows.length === 0) {
            res.writeHead(401, { 'Content-Type': 'application/json' }); // 401 Unauthorized 
            res.end(JSON.stringify({ error: 'Geçersiz e-posta veya şifre.' }));
            return;
        }
        const user: UserRow = userResult.rows[0]; // Bulunan kullanıcı bilgilerini alıyoruz.
        // --- Şifre Karşılaştırma ---.
        const isMatch: boolean = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            res.writeHead(401, { 'Content-Type': 'application/json' }); // 401 Unauthorized
            res.end(JSON.stringify({ error: 'Geçersiz e-posta veya şifre.' }));
            return;
        }
        // --- JWT (JSON Web Token) Oluşturma ---
        // Şifreler eşleşiyorsa, kullanıcı için bir JWT oluşturuyoruz.
        if (!JWT_SECRET) {
            throw new Error("JWT_SECRET tanımlı değil, token oluşturulamıyor.");
        }
        const token: string = jwt.sign(
            { id: user.id, username: user.username, email: user.email }, //payload
            JWT_SECRET, //tokeni imzalayan gizli anahtar
            { expiresIn: '1h' } 
        );
         res.writeHead(200, { 'Content-Type': 'application/json' }); 
         res.end(JSON.stringify({
         message: 'Giriş başarılı.',
         token: token, // Oluşturulan JWT'yi kullanıcıya gönderiyoruz
        // Kullanıcı bilgilerini de yanıtın içine ekliyoruz.
        user: { id: user.id, username: user.username, email: user.email }
 }));
    } catch (error: unknown) { 
        console.error('Giriş işlemi sırasında hata:', (error as Error).message); 
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' }); // 500  (Sunucu Hatası)
            res.end(JSON.stringify({ error: 'Sunucu hatası: Giriş yapılamadı.' }));
        }
    } finally {
        if (client) {
            client.release();
        }
    }
};
