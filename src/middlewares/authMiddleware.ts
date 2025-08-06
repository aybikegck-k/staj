// src/middlewares/authMiddleware.ts
// Bu dosya, HTTP isteklerinin kimlik doğrulamasını (JWT kontrolü) yapar.

import jwt from 'jsonwebtoken'; // JWT işlemleri için gerekli kütüphane
import 'dotenv/config'; // .env dosyasındaki ortam değişkenlerini yükler (JWT_SECRET için)
import { IncomingMessage, ServerResponse } from 'http'; // HTTP istek ve yanıt objeleri için tip tanımlamaları

console.log('Middleware JWT_SECRET:', process.env.JWT_SECRET);

// JWT gizli anahtarını .env dosyasından alıyoruz.
// Bu anahtar, token'ları imzalamak ve doğrulamak için kullanılır. ÇOK GİZLİ TUTULMALIDIR.
const JWT_SECRET: string | undefined = process.env.JWT_SECRET; // 'process.env.env.JWT_SECRET' yerine 'process.env.JWT_SECRET' olarak düzeltildi

// Eğer JWT_SECRET tanımlı değilse, uygulamanın çalışması imkansızdır.
// Bu durumda hata mesajı gösterip uygulamayı durdururuz.
if (!JWT_SECRET) {
    console.error("HATA: JWT_SECRET .env dosyasında tanımlanmamış! Lütfen .env dosyasını kontrol edin.");
    process.exit(1); // JWT_SECRET olmadan uygulama başlatılamaz
}

// JWT payload'ının (token içindeki verinin) yapısını tanımlıyoruz.
// Bu, jwt.verify'dan dönen 'decoded' objesinin tipini belirler.
interface JwtPayload {
    id: number;
    username: string; // 'username' özelliği eklendi
    email: string;
}

// req objesine 'user' özelliğini eklemek için özel bir tip tanımlıyoruz.
// Bu tip, hem IncomingMessage'ın tüm özelliklerini taşır hem de isteğe bağlı bir 'user' özelliği ekler.
export interface AuthenticatedRequest extends IncomingMessage {
    user?: {
        id: number;
        username: string; // 'username' özelliği eklendi ve zorunlu kılındı
        email: string;
    } | null; // Kullanıcı bilgisi olabilir veya null olabilir (anonim durumlar için)
}

// authenticateToken adında bir middleware fonksiyonu tanımlıyoruz.
// Middleware'ler, ana route (yol) handler'ına ulaşmadan önce istekleri işleyen ara katmanlardır.
// req: Gelen HTTP isteği objesi (request) - AuthenticatedRequest tipinde
// res: Gönderilecek HTTP yanıtı objesi (response) - ServerResponse tipinde
// callback: Middleware başarılı olursa çağrılacak bir sonraki fonksiyon.
//           Bu genellikle isteği işleyecek asıl fonksiyon (örn. /shorten içindeki kod) olur.
export const authenticateToken = async (req: AuthenticatedRequest, res: ServerResponse, callback: () => Promise<void>): Promise<void> => {
    // İsteğin başlıklarındaki (headers) 'authorization' alanını alıyoruz.
    // Kullanıcılar JWT token'larını bu başlık içinde gönderirler.
    // Formatı genellikle "Bearer TOKEN_DEĞERİ" şeklindedir.
    const authHeader: string | undefined = req.headers['authorization'];

    console.log('Gelen Authorization Başlığı:', authHeader);

    // authHeader varsa ve "Bearer " ile başlıyorsa, token değerini ayırarak alıyoruz.
    // Eğer yoksa veya format yanlışsa, token undefined olur.
    const token: string | undefined = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    console.log('Middleware Tarafından Ayrıştırılan Token:', token);

    // --- ANONİM ERİŞİM KONTROLÜ (TOKEN YOKSA) ---
    // Eğer istekte JWT token'ı yoksa (yani kullanıcı giriş yapmamış veya token göndermemişse):
    if (!token) { // Öncesinde token yokken direkt hata döndürüyordu şimdi token olmasa da çalışıyor (anonim giriş hakkı için)
        req.user = null; // req.user objesini null olarak belirliyoruz.
                         // Bu, bir sonraki işleyiciye (callback) bu isteğin anonim olduğunu bildirir.
        await callback(); // İsteğin işlenmeye devam etmesine izin veriyoruz.
                          // Bu sayede, token olmasa bile /shorten endpoint'indeki ana mantık çalışabilir.
        return; // Fonksiyonu burada sonlandırıyoruz, daha fazla kod çalıştırmaya gerek yok.
    }

    // --- YETKİLİ ERİŞİM KONTROLÜ (TOKEN VARSA) ---
    // Eğer istekte bir JWT token'ı varsa, bu token'ın geçerliliğini doğrulamaya çalışırız.
    try {
        // jwt.verify fonksiyonu bir callback tabanlı API olduğu için,
        // bunu bir Promise içine alarak async/await ile daha kolay kullanabilir hale getiriyoruz.
        // JWT_SECRET'ın string olduğundan emin olmak için tip kontrolü yapıyoruz.
        const user = await new Promise<JwtPayload>((resolve, reject) => {
            if (!JWT_SECRET) { // JWT_SECRET'ın undefined olma ihtimaline karşı tekrar kontrol
                return reject(new Error("JWT_SECRET tanımlı değil."));
            }
            // Token'ı gizli anahtar (JWT_SECRET) ile doğrula.
            // Eğer başarılı olursa, token'ın içindeki payload (kullanıcı bilgileri) 'decoded' olarak döner.
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (err) {
                    // Eğer token doğrulanamazsa (örn: geçersiz imza, süresi dolmuş, bozuk token):
                    return reject(err); // Promise'ı reddet ve hatayı yakala
                }
                // Token başarılı bir şekilde çözümlenirse, içindeki payload'ı (kullanıcı bilgileri) döndür.
                // 'decoded' objesinin JwtPayload arayüzüne uyduğunu varsayıyoruz.
                resolve(decoded as JwtPayload);
            });
        });

        // Doğrulanmış kullanıcı bilgilerini req.user objesine atıyoruz.
        // Böylece bir sonraki fonksiyon (callback) bu kullanıcının ID'sine, username'ine vb. erişebilir.
        req.user = user;
        await callback(); // İsteğin işlenmeye devam etmesine izin veriyoruz (ana route handler'ına geç).

    } catch (err: unknown) { // Hata tipini 'unknown' olarak belirttik
        // Token doğrulama sırasında herhangi bir hata oluşursa (örn. JWT_SECRET yanlış, token bozuk, süresi dolmuş):
        console.error('JWT doğrulama hatası:', (err as Error).message); // Hatanın detayını sunucu konsoluna yazdır
        res.writeHead(403, { 'Content-Type': 'application/json' }); // 403 Forbidden HTTP durum kodu gönderiyoruz.
                                                                    // Bu, isteğin yetkisiz olduğu anlamına gelir.
        res.end(JSON.stringify({ message: 'Erişim reddedildi: Geçersiz veya süresi dolmuş token.' }));
        // Middleware burada bir yanıt gönderdiği için, isteğin daha fazla ilerlemesini durdur.
        return;
    }
};

// Bu middleware fonksiyonunu dışarıya açıyoruz ki index.ts gibi diğer dosyalar kullanabilsin.
// 'export const' kullanarak named export sağlıyoruz.
