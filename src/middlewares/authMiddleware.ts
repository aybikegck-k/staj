// src/middlewares/authMiddleware.ts
// Bu dosya, HTTP isteklerinin kimlik doğrulamasını (JWT kontrolü) yapar.
import jwt from 'jsonwebtoken'; 
import 'dotenv/config'; 
import { IncomingMessage, ServerResponse } from 'http'; 

console.log('Middleware JWT_SECRET:', process.env.JWT_SECRET);
// Bu anahtar, token'ları imzalamak ve doğrulamak için kullanılır. ÇOK GİZLİ TUTULMALIDIR.
const JWT_SECRET: string | undefined = process.env.JWT_SECRET; 
// Eğer JWT_SECRET tanımlı değilse, uygulamanın çalışması imkansızdır.
if (!JWT_SECRET) {
    console.error("HATA: JWT_SECRET .env dosyasında tanımlanmamış! Lütfen .env dosyasını kontrol edin.");
    process.exit(1); 
}
interface JwtPayload { 
    id: number;
    username: string; 
    email: string;
}
// req objesine 'user' özelliğini eklemek için özel bir tip tanımlıyoruz.
// Bu tip, hem IncomingMessage'ın tüm özelliklerini taşır hem de isteğe bağlı bir 'user' özelliği ekler.
export interface AuthenticatedRequest extends IncomingMessage {
    user?: {
        id: number;
        username: string; 
        email: string;
    } | null; // Kullanıcı bilgisi olabilir veya null olabilir (anonim durumlar için)
}
// Middleware'ler, ana route (yol) handler'ına ulaşmadan önce istekleri işleyen ara katmanlardır.
export const authenticateToken = async (req: AuthenticatedRequest, res: ServerResponse, callback: () => Promise<void>): Promise<void> => {
    // Formatı genellikle "Bearer TOKEN_DEĞERİ" şeklindedir.
    const authHeader: string | undefined = req.headers['authorization'];
    console.log('Gelen Authorization Başlığı:', authHeader);
    // authHeader varsa ve "Bearer " ile başlıyorsa, token değerini ayırarak alıyoruz. yoksa hatalı
    const token: string | undefined = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    console.log('Middleware Tarafından Ayrıştırılan Token:', token);
    // --- ANONİM ERİŞİM KONTROLÜ (TOKEN YOKSA) ---
    if (!token) { 
        req.user = null;             
        await callback(); // İsteğin işlenmeye devam etmesine izin veriyoruz.// Bu sayede, token olmasa bile /shorten endpoint'indeki ana mantık çalışabilir.                
        return; 
    }
    // --- YETKİLİ ERİŞİM KONTROLÜ (TOKEN VARSA) ---
    // Eğer istekte bir JWT token'ı varsa, bu token'ın geçerliliğini doğrulamaya çalışırız.
    try {
        // JWT_SECRET'ın string olduğundan emin olmak için tip kontrolü yapıyoruz.
        const user = await new Promise<JwtPayload>((resolve, reject) => {
            if (!JWT_SECRET) { // JWT_SECRET'ın undefined olma ihtimaline karşı tekrar kontrol
                return reject(new Error("JWT_SECRET tanımlı değil."));
            }
            // Token'ı (JWT_SECRET) ile doğrula.
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (err) {
                    return reject(err); 
                }
                resolve(decoded as JwtPayload);
            });
        });
        // Doğrulanmış kullanıcı bilgilerini req.user objesine atıyoruz.
        req.user = user;
        await callback(); 
    } catch (err: unknown) { 
        console.error('JWT doğrulama hatası:', (err as Error).message); 
        res.writeHead(403, { 'Content-Type': 'application/json' }); // 403 Forbidden HTTP durum kodu gönderiyoruz.
                                                                    // Bu, isteğin yetkisiz olduğu anlamına gelir.
        res.end(JSON.stringify({ message: 'Erişim reddedildi: Geçersiz veya süresi dolmuş token.' }));
        return;
    }
};


