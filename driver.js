const cfg=window.APP_CONFIG||{},sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
let driver=null,vehicle=null,activeRide=null,polling=null;
function showOnly(id){['authView','registrationSuccess','pendingView','suspendedView','driverView'].forEach(x=>$(x)?.classList.add('hidden'));$(id)?.classList.remove('hidden')}
function err(id,m){$(id).textContent=m;$(id).classList.remove('hidden')}function clear(id){$(id).classList.add('hidden')}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function wa(p){p=String(p||'').replace(/\D/g,'');if(p.startsWith('0'))p='971'+p.slice(1);return p}
function reference(id){return 'D-'+String(id||'').replace(/-/g,'').slice(0,8).toUpperCase()}
function approval(s){return({pending:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض',suspended:'موقوف'})[s]||s||'—'}

$('loginTab').onclick=()=>{$('loginForm').classList.remove('hidden');$('registerForm').classList.add('hidden');$('loginTab').classList.add('active');$('registerTab').classList.remove('active')};
$('registerTab').onclick=()=>{$('registerForm').classList.remove('hidden');$('loginForm').classList.add('hidden');$('registerTab').classList.add('active');$('loginTab').classList.remove('active')};
if(new URLSearchParams(location.search).get('register'))setTimeout(()=>$('registerTab').click(),0);

$('registerForm').onsubmit=async e=>{
 e.preventDefault();clear('registerError');const fd=new FormData(e.currentTarget);
 const metadata={account_type:'driver',full_name:String(fd.get('full_name')).trim(),phone:String(fd.get('phone')).trim(),driving_license_no:String(fd.get('driving_license_no')).trim(),driving_license_expiry:fd.get('driving_license_expiry')||null,taxi_permit_no:String(fd.get('taxi_permit_no')||'').trim(),current_zone:fd.get('current_zone'),plate_number:String(fd.get('plate_number')).trim(),plate_emirate:fd.get('plate_emirate'),vehicle_make:String(fd.get('vehicle_make')).trim(),vehicle_model:String(fd.get('vehicle_model')).trim(),model_year:Number(fd.get('model_year')),vehicle_color:String(fd.get('vehicle_color')).trim(),registration_expiry:fd.get('registration_expiry')||null,insurance_expiry:fd.get('insurance_expiry')||null};
 const {data,error}=await sb.auth.signUp({email:String(fd.get('email')).trim(),password:fd.get('password'),options:{data:metadata}});
 if(error){err('registerError',error.message.toLowerCase().includes('already registered')?'هذا البريد الإلكتروني مسجل مسبقًا. استخدم دخول السائق.':error.message);return}
 try{await sb.auth.signOut();}catch(e){console.error('sign-out after register failed:',e)}
 e.currentTarget.reset();$('driverReference').textContent=reference(data.user?.id);showOnly('registrationSuccess');
};

$('goLogin').onclick=async()=>{await sb.auth.signOut();showOnly('authView');$('loginTab').click()};
$('loginForm').onsubmit=async e=>{e.preventDefault();clear('loginError');const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){err('loginError','بيانات الدخول غير صحيحة.');return}await routeUser()};
async function logout(){if(polling)clearInterval(polling);await sb.auth.signOut();location.reload()}
$('logoutBtn').onclick=logout;$('pendingLogout').onclick=logout;$('suspendedLogout').onclick=logout;

async function routeUser(){
 const {data:u}=await sb.auth.getUser();if(!u.user){showOnly('authView');return}
 const {data:d,error}=await sb.from('drivers').select('*').eq('user_id',u.user.id).maybeSingle();
 if(error||!d){await sb.auth.signOut();showOnly('authView');err('loginError','لم يكتمل إنشاء ملف السائق. تواصل مع الإدارة.');return}
 driver=d;
 const {data:v}=await sb.from('vehicles').select('*').eq('driver_id',d.id).order('created_at',{ascending:false}).limit(1);vehicle=v?.[0]||null;
 if(!vehicle||d.approval_status==='pending'||vehicle.approval_status==='pending'){
  $('pendingName').textContent=d.name||'—';$('pendingCar').textContent=vehicle?`${vehicle.make||''} ${vehicle.model||''}`.trim():(d.car_type||'—');$('pendingZone').textContent=d.current_zone||'—';showOnly('pendingView');return
 }
 if(['suspended','rejected'].includes(d.approval_status)||['suspended','rejected'].includes(vehicle.approval_status)){showOnly('suspendedView');return}
 if(d.approval_status!=='approved'||vehicle.approval_status!=='approved'){showOnly('pendingView');return}
 showOnly('driverView');renderDriver();await Promise.all([loadOffers(),loadActiveRide()]);
 if(polling)clearInterval(polling);polling=setInterval(async()=>{try{const {error}=await sb.rpc('refresh_dispatches');if(error)console.error('refresh_dispatches error:',error.message);await refreshDriver()}catch(e){console.error(e)}},10000);
}
function renderDriver(){
 $('driverHello').textContent=`مرحبًا ${driver.name||''}`;$('approvalStat').textContent=approval(driver.approval_status);
 $('subscriptionStat').textContent=driver.subscription_status==='trial'&&driver.trial_ends_at?`تجربة حتى ${new Date(driver.trial_ends_at).toLocaleDateString('ar-AE')}`:(driver.subscription_status||'—');
 $('availabilityStat').textContent=driver.is_busy?'في رحلة':driver.is_available?'متاح':'غير متاح';$('availabilityBtn').textContent=driver.is_available?'إيقاف استقبال الطلبات':'استقبل الطلبات';if(driver.current_zone)$('zoneSelect').value=driver.current_zone
}
async function refreshDriver(){const {data:u}=await sb.auth.getUser();if(!u.user)return;const {data:d}=await sb.from('drivers').select('*').eq('user_id',u.user.id).maybeSingle();if(!d)return;driver=d;const {data:v}=await sb.from('vehicles').select('*').eq('driver_id',d.id).order('created_at',{ascending:false}).limit(1);vehicle=v?.[0]||null;if(d.approval_status!=='approved'||vehicle?.approval_status!=='approved'){await routeUser();return}renderDriver();await Promise.all([loadOffers(),loadActiveRide()])}
$('availabilityBtn').onclick=async()=>{const {error}=await sb.rpc('set_driver_availability',{p_available:!driver.is_available,p_zone:$('zoneSelect').value});if(error)return alert(error.message);await refreshDriver()};
$('refreshBtn').onclick=async()=>{
 const btn=$('refreshBtn');const oldText=btn.textContent;btn.disabled=true;btn.textContent='جارٍ التحديث...';
 try{
  const {error}=await sb.rpc('refresh_dispatches');
  if(error){alert('تعذر التحديث: '+error.message);return}
  await refreshDriver();
 }catch(e){alert('تعذر التحديث: '+(e.message||'خطأ غير متوقع'))}
 finally{btn.disabled=false;btn.textContent=oldText}
};

/* ===== تنبيه صوتي عند وصول طلب جديد ===== */
let lastOfferCount=0;
function playNewOfferSound(){
 try{
  const ctx=new (window.AudioContext||window.webkitAudioContext)();
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.connect(g);g.connect(ctx.destination);
  o.type='sine';o.frequency.value=880;
  g.gain.setValueAtTime(0.25,ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.6);
  o.start();o.stop(ctx.currentTime+0.6);
 }catch(e){console.error('sound error',e)}
}

async function loadOffers(){
 const {data,error}=await sb.rpc('get_driver_offers');
 if(error){console.error(error);return}
 const list=data||[];
 if(list.length>lastOfferCount)playNewOfferSound();
 lastOfferCount=list.length;
 $('offers').innerHTML=list.length?list.map(o=>`<article class="ride-card"><strong>طلب ${esc(o.order_number)}</strong><div class="ride-grid"><div>الانطلاق<b>${esc(o.pickup)}</b></div><div>الوجهة<b>${esc(o.destination)}</b></div><div>المنطقة<b>${esc(o.pickup_zone||'—')}</b></div><div>الركاب<b>${esc(o.passengers)}</b></div></div><div class="ride-actions"><button class="primary" onclick="acceptRide('${o.ride_id}')">قبول الطلب</button></div></article>`).join(''):'<div class="empty-state"><strong>لا توجد طلبات جديدة</strong></div>'
}
window.acceptRide=async id=>{const {error}=await sb.rpc('accept_ride',{p_ride_id:id});if(error){alert(error.message);return}await refreshDriver()};
async function loadActiveRide(){const {data,error}=await sb.from('ride_requests').select('*').eq('driver_id',driver.id).in('status',['accepted','on_the_way','arrived','started']).order('accepted_at',{ascending:false}).limit(1);if(error)return console.error(error);activeRide=data?.[0]||null;renderRide()}
function renderRide(){
 if(!activeRide){$('activeRide').innerHTML='<div class="empty-state"><strong>لا توجد رحلة حالية</strong></div>';return}
 const r=activeRide,next={accepted:['on_the_way','في الطريق إلى العميل'],on_the_way:['arrived','وصلت إلى العميل'],arrived:['started','بدء الرحلة'],started:['completed','إنهاء الرحلة']}[r.status];
 $('activeRide').innerHTML=`<article class="ride-card"><strong>${esc(r.order_number)}</strong><div class="ride-grid"><div>العميل<b>${esc(r.customer_name)}</b></div><div>الهاتف<b>${esc(r.phone)}</b></div><div>الانطلاق<b>${esc(r.pickup)}</b></div><div>الوجهة<b>${esc(r.destination)}</b></div></div><div class="ride-actions"><a class="secondary" href="tel:${esc(r.phone)}">اتصال</a><a class="secondary" target="_blank" href="https://wa.me/${wa(r.phone)}">واتساب</a>${next?`<button class="primary" onclick="advanceRide('${r.id}','${next[0]}')">${next[1]}</button>`:''}</div></article>`
}
window.advanceRide=async(id,status)=>{const {error}=await sb.rpc('driver_update_ride_status',{p_ride_id:id,p_status:status});if(error)return alert(error.message);await refreshDriver()};
(async()=>{const {data}=await sb.auth.getSession();if(data.session)await routeUser();else showOnly('authView')})();
