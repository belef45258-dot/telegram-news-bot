# بوت أخبار الشرق الأوسط على Telegram

هذا المشروع نسخة مجانية مبسطة تعمل على Cloudflare Workers. يجلب الأخبار من خلاصات RSS كل 15 دقيقة، يزيل الروابط التي سبق نشرها لمدة سبعة أيام، يصنف الخبر بكلمات مفتاحية إلى سياسي أو عسكري أو أمني أو اقتصادي أو اجتماعي، ثم يرسل عنوانًا وملخصًا ورابط المصدر إلى Telegram.

## المتطلبات

ستحتاج إلى حساب مجاني في Cloudflare، وحساب Telegram، وبوت تنشئه عبر [@BotFather](https://t.me/BotFather). لا تضع رمز البوت داخل الملفات أو المستودع العام.

## الإعداد

ثبت Wrangler على جهازك:

```bash
npm install -g wrangler
wrangler login
```

أنشئ مساحة KV:

```bash
wrangler kv namespace create NEWS_KV
```

انسخ `id` الناتج إلى `wrangler.toml` بدل القيمة الوهمية. بعد ذلك خزّن الأسرار:

```bash
wrangler secret put BOT_TOKEN
wrangler secret put WEBHOOK_SECRET
```

اجعل `WEBHOOK_SECRET` سلسلة عشوائية طويلة من الأحرف والأرقام والشرطتين السفلية والواصلة.

انشر Worker:

```bash
wrangler deploy
```

سيظهر عنوان HTTPS مثل:

```text
https://middle-east-news-bot.<your-subdomain>.workers.dev
```

عيّن Webhook في Telegram، مع استبدال القيم:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<worker-url>" \
  -d "secret_token=<WEBHOOK_SECRET>" \
  -d "drop_pending_updates=true"
```

أرسل `/start` إلى البوت. عندها تُحفظ محادثتك كوجهة خاصة للمستخدم الإداري. لإرسال الأخبار إلى قناة، أضف البوت إلى القناة بوصفه مشرفًا مع صلاحية نشر الرسائل، ثم أرسل `/setchannel` من محادثة القناة أو عدّل `channel_id` في KV بالطريقة التي ستُضاف في النسخة التالية. يمكن بدء جلب فوري بإرسال `/collect`، وإيقاف أو تشغيل النشر بواسطة `/off` و`/on`.

## ملاحظات مهمة

المصادر الحالية هي BBC Arabic وAl Jazeera English وFrance 24 English وخلاصات حكومية أمريكية أرشيفية وJerusalem Post. ينبغي اختبار كل خلاصة عند النشر، لأن بعض المواقع قد تغيّر روابط RSS أو تمنع الطلبات الآلية. الملخص في هذه النسخة استخراج تلقائي قصير من وصف RSS ولا يستخدم نموذجًا مدفوعًا؛ وهذا يحافظ على مجانية التشغيل لكنه لا يرقى إلى تلخيص تحليلي بشري.

الخطة المجانية ليست ضمانًا تجاريًا مطلقًا. حدود Cloudflare أو تغييرات المواقع الخارجية قد تؤثر في الخدمة، لذلك يُنصح بإضافة سجل أخطاء ومراقبة دورية عند الانتقال إلى الاستخدام الفعلي.
