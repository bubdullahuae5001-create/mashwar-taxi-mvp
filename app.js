const cfg=window.APP_CONFIG||{};
const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const booking=$('bookingDialog'),form=$('rideForm'),confirmDialog=$('confirmDialog'),success=$('successDialog');
let pending=null;

const translations={
 ar:{heroTitle:'مشوارك يبدأ من هنا',heroSub:'اطلب سيارة أجرة في أم القيوين بخطوات بسيطة وسريعة.',openBooking:'طلب سيارة',driverCta:'تسجيل سائق',whyTitle:'لماذا مشوار؟',b1t:'توزيع تلقائي',b1p:'يرسل الطلب مباشرة إلى السائقين المتاحين.',b2t:'سائقون معتمدون',b2p:'اعتماد السائق والمركبة يتم حسب إعدادات النظام.',b3t:'بدون تطبيق',b3p:'اطلب وتابع رحلتك من المتصفح مباشرة.',bookingTitle:'طلب سيارة',bookingSub:'أدخل بيانات الرحلة ثم أكد الطلب.',lblName:'الاسم',lblPhone:'رقم الهاتف',lblPickup:'موقع الانطلاق',lblDestination:'الوجهة',lblZone:'منطقة الانطلاق',lblPassengers:'عدد الركاب',lblTime:'وقت الطلب',lblNotes:'ملاحظات اختيارية',continueRequest:'متابعة الطلب',successTitle:'تم استلام طلبك',thanksText:'شكرًا لاختيارك مشوار',successText:'بدأ النظام البحث عن سائق مناسب.'},
 en:{heroTitle:'Your ride starts here',heroSub:'Request a taxi in Umm Al Quwain in a few simple steps.',openBooking:'Request a car',driverCta:'Driver signup',whyTitle:'Why Mashwar?',b1t:'Automatic dispatch',b1p:'Requests go directly to available drivers.',b2t:'Approved drivers',b2p:'Driver and vehicle activation follows operating rules.',b3t:'No app needed',b3p:'Request and track your ride from the browser.',bookingTitle:'Request a car',bookingSub:'Enter trip details, then confirm.',lblName:'Name',lblPhone:'Phone',lblPickup:'Pickup',lblDestination:'Destination',lblZone:'Pickup area',lblPassengers:'Passengers',lblTime:'Request time',lblNotes:'Optional notes',continueRequest:'Continue',successTitle:'Request received',thanksText:'Thank you for choosing Mashwar',successText:'We started looking for a suitable driver.'},
 ur:{heroTitle:'آپ کا سفر یہاں سے شروع ہوتا ہے',heroSub:'ام القیوین میں آسان مراحل میں ٹیکسی طلب کریں۔',openBooking:'گاڑی طلب کریں',driverCta:'ڈرائیور رجسٹریشن',whyTitle:'مشوار کیوں؟',b1t:'خودکار تقسیم',b1p:'درخواست دستیاب ڈرائیوروں تک براہ راست پہنچتی ہے۔',b2t:'منظور شدہ ڈرائیور',b2p:'ڈرائیور اور گاڑی انتظامیہ کے قواعد کے مطابق فعال ہوتے ہیں۔',b3t:'ایپ کی ضرورت نہیں',b3p:'براؤزر سے درخواست اور ٹریکنگ کریں۔',bookingTitle:'گاڑی طلب کریں',bookingSub:'سفر کی تفصیلات درج کریں اور تصدیق کریں۔',lblName:'نام',lblPhone:'فون نمبر',lblPickup:'روانگی',lblDestination:'منزل',lblZone:'روانگی کا علاقہ',lblPassengers:'مسافر',lblTime:'وقت',lblNotes:'اختیاری نوٹس',continueRequest:'جاری رکھیں',successTitle:'درخواست موصول ہوگئی',thanksText:'مشوار منتخب کرنے کا شکریہ',successText:'مناسب ڈرائیور کی تلاش شروع ہوگئی ہے۔'}
};
function setLang(lang){lang=translations[lang]?lang:'ar';localStorage.setItem('mashwar_lang',lang);document.documentElement.lang=lang;document.documentElement.dir=lang==='en'?'ltr':'rtl';$('languageSelect').value=lang;for(const [id,text] of Object.entries(translations[lang]))if($(id))$(id).textContent=text}
$('languageSelect').onchange=()=>setLang($('languageSelect').value);setLang(localStorage.getItem('mashwar_lang')||'ar');

function normPhone(v){let p=String(v||'').replace(/\D/g,'');if(p.startsWith('00971'))p='0'+p.slice(5);else if(p.startsWith('971'))p='0'+p.slice(3);return p}
function validPhone(v){return /^05\d{8}$/.test(normPhone(v))}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function orderNo(){const d=new Date(),rnd=crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,5).toUpperCase();return `R${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${rnd}`}

$('openBooking').onclick=()=>booking.showModal();
$('closeBooking').onclick=()=>booking.close();
form.timeType.onchange=()=>{$('laterWrap').classList.toggle('hidden',form.timeType.value!=='later');form.scheduledAt.required=form.timeType.value==='later'};

form.onsubmit=e=>{
 e.preventDefault();$('formError').classList.add('hidden');if(!form.reportValidity())return;
 const fd=new FormData(form),phone=normPhone(fd.get('phone')),type=fd.get('timeType');
 if(!validPhone(phone)){$('formError').textContent='أدخل رقم هاتف إماراتي صحيح مثل 0501234567.';$('formError').classList.remove('hidden');return}
 const scheduled=type==='later'?new Date(fd.get('scheduledAt')):null;if(type==='later'&&(!scheduled||scheduled.getTime()<=Date.now())){$('formError').textContent='اختر موعدًا مستقبليًا صحيحًا.';$('formError').classList.remove('hidden');return}
 pending={order_number:orderNo(),customer_name:String(fd.get('customerName')).trim(),phone,pickup:String(fd.get('pickup')).trim(),pickup_zone:fd.get('pickupZone'),destination:String(fd.get('destination')).trim(),request_type:type,scheduled_at:type==='later'?scheduled.toISOString():null,passengers:Number(fd.get('passengers')),notes:String(fd.get('notes')||'').trim()||null,status:'new'};
 const rows=[['الاسم',pending.customer_name],['الانطلاق',pending.pickup],['المنطقة',pending.pickup_zone],['الوجهة',pending.destination],['الهاتف',pending.phone],['الركاب',pending.passengers]];
 $('summary').innerHTML=rows.map(([a,b])=>`<div class="summary-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');booking.close();confirmDialog.showModal();
};
$('editRequest').onclick=()=>{confirmDialog.close();booking.showModal()};
$('confirmRequest').onclick=async()=>{
 const btn=$('confirmRequest');btn.disabled=true;btn.textContent='جارٍ الإرسال...';
 try{const {error}=await sb.from('ride_requests').insert(pending);if(error)throw error;$('orderNumber').textContent=pending.order_number;$('trackRequestLink').href=`track.html?order=${encodeURIComponent(pending.order_number)}&phone=${encodeURIComponent(pending.phone)}`;localStorage.setItem('mashwar_last_order',JSON.stringify({order:pending.order_number,phone:pending.phone}));confirmDialog.close();success.showModal();form.reset();$('laterWrap').classList.add('hidden')}
 catch(err){alert(err.message||'تعذر إرسال الطلب.')}
 finally{btn.disabled=false;btn.textContent='تأكيد الطلب'}
};
$('closeSuccess').onclick=()=>success.close();
