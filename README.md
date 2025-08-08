
# 🐾 Linkie 
Linkie, kullanıcıların uzun URL'leri kısa ve paylaşılabilir hale getirmesini sağlayan bir bağlantı kısaltma uygulamasıdır.  
Frontend saf HTML/CSS/JS ile, backend ise TypeScript kullanılarak geliştirilmiştir. Veritabanı olarak PostgreSQL tercih edilmiştir ve Docker ile çalıştırılır.

## 📦 Gereksinimler

Projeyi çalıştırmak için aşağıdaki yazılımların sisteminizde kurulu olması gerekir:

- [Node.js](https://nodejs.org/) (v18+ önerilir)
- [Docker](https://www.docker.com/)
- [Git](https://git-scm.com/)
- Paket yöneticisi: `npm` 

### 🛠️ Ortam Değişkenleri (.env)

Projenin çalışabilmesi için, kök dizinde bir `.env` dosyası oluşturun. Bunun için aşağıdaki komutu kullanabilirsiniz:

```bash
cp .env.example .env

Örnek dosya için .env.example'ı inceleyebilirsiniz

📄 Örnek .env.example Dosyası

# PostgreSQL Veritabanı Bağlantı Bilgileri
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=url_shortener_ts_db
DB_PASSWORD=your_db_password_here
DB_PORT=5432

# JWT (JSON Web Token) Gizli Anahtarı
JWT_SECRET=your_super_secret_jwt_key_here

.env dosyasına kendi veritabanı şifrenizi ve gizli JWT anahtarınızı girin.

 1.Veritabanını Docker ile Başlatın

cd db
docker-compose up -d

Bu komut PostgreSQL veritabanını başlatır. Varsayılan ayarlar:

Bu komut PostgreSQL veritabanını arka planda başlatır. Varsayılan veritabanı ayarları şunlardır:

* **Port:** 5432
* **Kullanıcı:** postgres
* **Şifre:** 260922
* **Veritabanı:** url_shortener_ts_db

2.Backend'i başlatın

Backend sunucusunu başlatmak için:

* `cd backend`
* `npm install`
* `npm run dev`

Backend TypeScript ile yazılmıştır. tsconfig.json dosyası derleme ayarlarını içerir. Veritabanı bağlantısı .env dosyasındaki bilgilerle yapılır.

3.Frontend'i çalıştırın

Frontend'i çalıştırmak için:

* `cd frontend`
* `index.html` dosyasını tarayıcınızda açın.


Veritabanı Şeması (PostgreSQL)

### 📁 Tablo: users

| Alan | Tip | Açıklama |
| :--- | :--- | :--- |
| id | SERIAL | Otomatik artan benzersiz ID |
| username | VARCHAR(50) | Benzersiz kullanıcı adı |
| email | VARCHAR(100) | Benzersiz e-posta adresi |
| password_hash | VARCHAR(255) | Hashlenmiş şifre |
| created_at | TIMESTAMP | Kayıt tarihi |


### 📁 Tablo: urls
| Alan | Tip | Açıklama |
| :--- | :--- | :--- |
| id | SERIAL | Otomatik artan benzersiz ID |
| original_url | TEXT | Uzun URL |
| short_code | VARCHAR(10) | Benzersiz kısa kod |
| user_id | INTEGER | users tablosuna referans (isteğe bağlı) |
| ip_address | VARCHAR(45) | Anonim kullanıcı IP adresi |
| click_count | INTEGER | Tıklama sayısı |
| created_at | TIMESTAMP | Oluşturulma tarihi |


### 🔐 API Uç Noktaları

| Metot | Yol | Açıklama |
| :--- | :--- | :--- |
| `POST` | `/register` | Yeni kullanıcı oluşturur |
| `POST` | `/login` | Giriş yapar, JWT token döner |
| `POST` | `/shorten` | Uzun URL'yi kısaltır |
| `GET` | `/urls` | Kullanıcının URL listesini döner |
| `GET` | `/:shortCode` | Kısaltılmış URL'yi yönlendirir |

### 👩‍💻 Geliştirici Notları

* Veritabanı bağlantısı `pg` modülü ile sağlanır.
* Şifreler `bcrypt` ile hashlenir.
* JWT ile oturum yönetimi yapılır.
* IP adresi takibi anonim kullanıcılar için yapılır.
* Tüm URL'ler `short_code` üzerinden yönlendirilir.
