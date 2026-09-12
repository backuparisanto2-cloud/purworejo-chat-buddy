# Purworejo chatbot Apps

Buat aplikasi web sederhana bernama “Purworejo chatbot Apps” untuk TAHAP 1. Fokus ketat pada alur Chatera webhook → aplikasi → Supabase/Lovable Cloud → dashboard. Buat dashboard sederhana yang menampilkan pesan WhatsApp inbound: nama pengirim, nomor pengirim, isi pesan, waktu, message ID, conversation ID, dan channel ID. Tambahkan endpoint POST /api/webhooks/chatera untuk menerima event resmi `message.inbound` dengan field payload: data.sender.phone, data.sender.name, data.content.text, data.messageId, data.conversationId, data.channelId. Verifikasi request dengan headers X-Chatera-Timestamp, X-Chatera-Signature, X-Chatera-Event, X-Chatera-Delivery-Id menggunakan HMAC-SHA256 sesuai dokumentasi resmi https://docs.chatera.id/api/webhooks. Simpan credential/API secret dan webhook secret hanya server-side. Gunakan delivery ID sebagai deduplikasi agar pesan sama tidak tersimpan dua kali. Aktifkan backend managed dan persistence. Jangan buat chatbot, AI/NLU, menu Purworejo, login warga, pengiriman WhatsApp, atau integrasi WhatsApp langsung. Setelah selesai, beri ringkasan file/struktur yang dibuat dan langkah uji endpoint webhook.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chatera-whisper.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/58bcab81-291a-4cc2-8459-72a326b73401).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
