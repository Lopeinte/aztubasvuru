# 🎯 AzTU Kamikaze İDA | Komanda Qəbulu və Süni İntellekt Mülakat Portalı

Azərbaycan Texniki Universiteti (AzTU) Kamikaze İnsansız Dəniz Aracı (İDA) mühəndislik komandası üçün hazırlanmış müstəqil, təhlükəsiz və süni intellekt dəstəkli namizəd qəbul və qiymətləndirmə sistemi.

---

## 🚀 Əsas Üstünlüklər və Xüsusiyyətlər

1. **Sıfır IP İfşası (Maksimum Təhlükəsizlik):**
   - Əsas serverinizlə və ya IP ünvanınızla heç bir əlaqəsi yoxdur.
   - Vercel və ya Cloudflare üzərindən işlədildikdə namizədlər yalnız qlobal CDN görürlər.
2. **1-ci Kurs Səviyyəsinə Uyğun 5 Analitik Sual:**
   - Ağır formul və ya nəzəriyyə yerinə mühəndislik refleksi, Fail-Safe kriz idarəetməsi, öyrənmə iştahı və atelye motivasiyası yoxlanılır.
3. **Məcburi Bölüm və Məlumat Girişi:**
   - Ad Soyad, Qrup / Tələbə No, Əlaqə / WhatsApp Nömrəsi
   - Fakültə / Bölüm:
     - ⚡ Elektrik və Elektronika Mühəndisliyi (EEM)
     - ⚙️ Mexanika Mühəndisliyi
     - 💻 Kompüter / Proqramlaşdırma Mühəndisliyi
     - 🛠️ Digər Mühəndisliklər
   - Maraqlandığı Alt Komanda (Avyonika, Mexanika/Korpus, Yazılım/Süni İntellekt, Layihə İdarəetməsi)
4. **3 Dilli Sistem (AZ / TR / EN):**
   - Həm forma arayüzü, həm də suallar Azərbaycanca, Türkcə və İngiliscə tam tərcümə olunub.
5. **Google Gemini Süni İntellekt Analizi:**
   - Hər müraciət göndərildikdə Gemini modeli arxa planda cavabları analiz edir:
     - **0 - 100 Arası Bal**
     - **ChatGPT / Süni İntellekt Kopyalama Şübhəsi** (Aşağı / Orta / Yüksək)
     - **Tövsiyə Olunan Alt Ekip** (Avyonika, Mexanika, Yazılım və s.)
     - **3 Maddəlik Rəhbərlik Xülasəsi**
     - **Bölüm Uyğunluq Təhlili**
6. **Rəhbərlik Paneli (`/admin`):**
   - **Giriş Şifrəsi:** `aztuida2026`
   - Bütün namizədləri canlı izləmə, ada/qrupa/telefona görə axtarış.
   - Bölüm və Bala görə filtrləmə.
   - Tək kliklə namizədə WhatsApp-dan yazma linki.
   - Bütün siyahını bir kliklə **Excel / CSV** formatında yükləmə.

---

## 🛠️ Lokal İstifadə (Öz Kompüterinizdə)

Sistem `C:\Users\eneso\.gemini\antigravity\scratch\kamikaze-ida-mulakat` qovluğunda hazırdır.

1. Qovluqdakı `start.bat` faylına iki dəfə klikləyin.
2. Brauzerinizdə açın:
   - **Başvuru Portalı:** [http://localhost:3005](http://localhost:3005)
   - **Rəhbərlik Paneli:** [http://localhost:3005/admin](http://localhost:3005/admin) (Şifrə: `aztuida2026`)

---

## 🌐 Dünyaya / İnternetə Açmaq (1 Dəqiqəlik Vercel Deploy - Sıfır IP İfşası)

Kompüterinizi açıq saxlamadan və server IP-nizi heç kimə göstərmədən hamıya açıq etmək üçün:

1. Bu qovluğu GitHub-a yükləyin (və ya birbaşa Vercel CLI istifadə edin).
2. [Vercel.com](https://vercel.com) saytında **"Add New Project"** deyib bu layihəni seçin.
3. Environment Variables (Mühit Dəyişənləri) bölməsinə aşağıdakıları əlavə edin:
   - `GEMINI_API_KEY`: `your_gemini_api_key_here`
   - `ADMIN_PASSWORD`: `aztuida2026`
4. **"Deploy"** düyməsinə klikləyin.
5. Vercel sizə `https://kamikaze-ida-mulakat.vercel.app` kimi pulsuz, SSL sertifikatlı və sürətli bir link verəcək!
