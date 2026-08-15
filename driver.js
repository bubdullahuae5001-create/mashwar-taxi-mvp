const cfg=window.APP_CONFIG||{},sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
let driver=null,vehicle=null,activeRide=null,polling=null;
function showOnly(id){['authView','registrationSuccess','pendingView','suspendedView','driverView','settingsView'].forEach(x=>$(x)?.classList.add('hidden'));$(id)?.classList.remove('hidden')}
function err(id,m){$(id).textContent=m;$(id).classList.remove('hidden')}function clear(id){$(id).classList.add('hidden')}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function wa(p){p=String(p||'').replace(/\D/g,'');if(p.startsWith('0'))p='971'+p.slice(1);return p}
function reference(id){return 'D-'+String(id||'').replace(/-/g,'').slice(0,8).toUpperCase()}
function approval(s){return({pending:t('approval_pending'),approved:t('approval_approved'),rejected:t('approval_rejected'),suspended:t('approval_suspended')})[s]||s||'—'}
function validPhone(v){return /^05\d{8}$/.test(String(v||'').trim())}
const DRIVER_TERMS_VERSION='MASHWAR-DRIVER-TERMS-2026-08-15';
const termsDialog=$('termsDialog');
function openTerms(){termsDialog?.showModal()}
function closeTerms(){termsDialog?.close()}
$('openTerms')?.addEventListener('click',openTerms);$('inlineTerms')?.addEventListener('click',openTerms);$('closeTermsX')?.addEventListener('click',closeTerms);$('closeTerms')?.addEventListener('click',closeTerms);
$('acceptTerms')?.addEventListener('click',()=>{const box=document.querySelector('input[name="transport_terms"]');if(box)box.checked=true;closeTerms()});

$('loginTab').onclick=()=>{$('loginForm').classList.remove('hidden');$('registerForm').classList.add('hidden');$('loginTab').classList.add('active');$('registerTab').classList.remove('active')};
$('registerTab').onclick=()=>{$('registerForm').classList.remove('hidden');$('loginForm').classList.add('hidden');$('registerTab').classList.add('active');$('loginTab').classList.remove('active')};
if(new URLSearchParams(location.search).get('register'))setTimeout(()=>$('registerTab').click(),0);

$('registerForm').onsubmit=async e=>{
 e.preventDefault();clear('registerError');
 const formEl=e.currentTarget;const fd=new FormData(formEl);
 if(fd.get('agree_all')!=='on'){err('registerError','يجب قراءة الشروط والموافقة عليها قبل إنشاء الحساب.');return}
 const submitBtn=formEl.querySelector('button[type="submit"]');
 const oldBtnText=submitBtn?submitBtn.textContent:'';
 if(submitBtn){submitBtn.disabled=true;submitBtn.textContent=t('register_sending')}
 try{
  const consentAt=new Date().toISOString();
  const metadata={account_type:'driver',full_name:String(fd.get('full_name')).trim(),phone:String(fd.get('phone')).trim(),driving_license_no:String(fd.get('driving_license_no')).trim(),driving_license_expiry:fd.get('driving_license_expiry')||null,taxi_permit_no:String(fd.get('taxi_permit_no')||'').trim(),current_zone:fd.get('current_zone'),plate_number:String(fd.get('plate_number')).trim(),plate_emirate:fd.get('plate_emirate'),vehicle_make:String(fd.get('vehicle_make')).trim(),vehicle_model:String(fd.get('vehicle_model')).trim(),model_year:Number(fd.get('model_year')),vehicle_color:String(fd.get('vehicle_color')).trim(),registration_expiry:fd.get('registration_expiry')||null,insurance_expiry:fd.get('insurance_expiry')||null,data_declaration_accepted:true,transport_terms_accepted:true,terms_version:DRIVER_TERMS_VERSION,terms_accepted_at:consentAt};
  const {data,error}=await sb.auth.signUp({email:String(fd.get('email')).trim(),password:fd.get('password'),options:{data:metadata}});
  if(error){err('registerError',error.message.toLowerCase().includes('already registered')?'هذا البريد الإلكتروني مسجل مسبقًا. استخدم دخول السائق.':error.message);return}
  try{await sb.auth.signOut();}catch(e2){console.error('sign-out after register failed:',e2)}
  formEl.reset();$('driverReference').textContent=reference(data.user?.id);showOnly('registrationSuccess');
 }catch(fatalError){
  err('registerError','حدث خطأ غير متوقع: '+(fatalError.message||'تعذر إتمام التسجيل. حاول مرة أخرى.'));
 }finally{
  if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=oldBtnText}
 }
};

$('goLogin').onclick=async()=>{await sb.auth.signOut();showOnly('authView');$('loginTab').click()};
$('loginForm').onsubmit=async e=>{e.preventDefault();clear('loginError');const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){err('loginError',t('login_error'));return}await routeUser()};
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
 $('driverHello').textContent=`${t('hello_prefix')} ${driver.name||''}`;$('approvalStat').textContent=approval(driver.approval_status);
 const dateLocale=getLang()==='en'?'en-GB':(getLang()==='ur'?'ur-PK':'ar-AE');
 $('subscriptionStat').textContent=driver.subscription_status==='trial'&&driver.trial_ends_at?`${t('trial_prefix')} ${new Date(driver.trial_ends_at).toLocaleDateString(dateLocale)}`:(driver.subscription_status||'—');
 $('availabilityStat').textContent=driver.is_busy?t('availability_busy'):driver.is_available?t('availability_available'):t('availability_unavailable');
 $('availabilityBtn').textContent=driver.is_available?t('availability_stop'):t('availability_become_available');
 if(driver.current_zone)$('zoneSelect').value=driver.current_zone
}
async function refreshDriver(){const {data:u}=await sb.auth.getUser();if(!u.user)return;const {data:d}=await sb.from('drivers').select('*').eq('user_id',u.user.id).maybeSingle();if(!d)return;driver=d;const {data:v}=await sb.from('vehicles').select('*').eq('driver_id',d.id).order('created_at',{ascending:false}).limit(1);vehicle=v?.[0]||null;if(d.approval_status!=='approved'||vehicle?.approval_status!=='approved'){await routeUser();return}renderDriver();await Promise.all([loadOffers(),loadActiveRide()])}
$('availabilityBtn').onclick=async()=>{const {error}=await sb.rpc('set_driver_availability',{p_available:!driver.is_available,p_zone:$('zoneSelect').value});if(error)return alert(error.message);await refreshDriver()};
$('refreshBtn').onclick=async()=>{
 const btn=$('refreshBtn');const oldText=btn.textContent;btn.disabled=true;btn.textContent=t('refresh_sending');
 try{
  const {error}=await sb.rpc('refresh_dispatches');
  if(error){alert('تعذر التحديث: '+error.message);return}
  await refreshDriver();
 }catch(e){alert('تعذر التحديث: '+(e.message||'خطأ غير متوقع'))}
 finally{btn.disabled=false;btn.textContent=t('refresh_btn')}
};

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

let lastOffersData=[];
async function loadOffers(){
 const {data,error}=await sb.rpc('get_driver_offers');
 if(error){console.error(error);return}
 const list=data||[];
 if(list.length>lastOfferCount)playNewOfferSound();
 lastOfferCount=list.length;
 lastOffersData=list;
 renderOffers();
}
function renderOffers(){
 const list=lastOffersData;
 $('offers').innerHTML=list.length?list.map(o=>`<article class="ride-card"><strong>${esc(t('offer_label_order'))} ${esc(o.order_number)}</strong><div class="ride-grid"><div>${esc(t('lblPickup'))}<b>${esc(o.pickup)}</b></div><div>${esc(t('lblDestination'))}<b>${esc(o.destination)}</b></div><div>${esc(t('lblZone'))}<b>${esc(o.pickup_zone||'—')}</b></div><div>${esc(t('lblPassengers'))}<b>${esc(o.passengers)}</b></div></div><div class="ride-actions"><button class="primary" onclick="acceptRide('${o.ride_id}')">${esc(t('accept_btn'))}</button></div></article>`).join(''):`<div class="empty-state"><strong>${esc(t('offers_empty'))}</strong></div>`
}
window.acceptRide=async id=>{const {error}=await sb.rpc('accept_ride',{p_ride_id:id});if(error){alert(error.message);return}await refreshDriver()};
async function loadActiveRide(){const {data,error}=await sb.from('ride_requests').select('*').eq('driver_id',driver.id).in('status',['accepted','on_the_way','arrived','started']).order('accepted_at',{ascending:false}).limit(1);if(error)return console.error(error);activeRide=data?.[0]||null;renderRide()}
function renderRide(){
 if(!activeRide){$('activeRide').innerHTML=`<div class="empty-state"><strong>${esc(t('active_ride_empty'))}</strong></div>`;return}
 const r=activeRide,next={accepted:['on_the_way',t('advance_on_the_way')],on_the_way:['arrived',t('advance_arrived')],arrived:['started',t('advance_started')],started:['completed',t('advance_completed')]}[r.status];
 $('activeRide').innerHTML=`<article class="ride-card"><strong>${esc(r.order_number)}</strong><div class="ride-grid"><div>${esc(t('ride_label_customer'))}<b>${esc(r.customer_name)}</b></div><div>${esc(t('lblPhone'))}<b>${esc(r.phone)}</b></div><div>${esc(t('lblPickup'))}<b>${esc(r.pickup)}</b></div><div>${esc(t('lblDestination'))}<b>${esc(r.destination)}</b></div></div><div class="ride-actions"><a class="secondary" href="tel:${esc(r.phone)}">${esc(t('call_btn'))}</a><a class="secondary" target="_blank" href="https://wa.me/${wa(r.phone)}">${esc(t('whatsapp_btn'))}</a>${next?`<button class="primary" onclick="advanceRide('${r.id}','${next[0]}')">${esc(next[1])}</button>`:''}</div></article>`
}
window.advanceRide=async(id,status)=>{const {error}=await sb.rpc('driver_update_ride_status',{p_ride_id:id,p_status:status});if(error)return alert(error.message);await refreshDriver()};

/* ===== الإعدادات ===== */
function populateSettingsForm(){
 clear('profileSettingsError');clear('profileSettingsSuccess');
 clear('vehicleSettingsError');clear('vehicleSettingsSuccess');
 clear('emailSettingsError');clear('emailSettingsSuccess');
 clear('passwordSettingsError');clear('passwordSettingsSuccess');
 const pf=$('profileSettingsForm');
 pf.name.value=driver?.name||'';pf.phone.value=driver?.phone||'';if(driver?.current_zone)pf.current_zone.value=driver.current_zone;
 const vf=$('vehicleSettingsForm');
 vf.make.value=vehicle?.make||'';vf.model.value=vehicle?.model||'';vf.model_year.value=vehicle?.model_year||'';vf.color.value=vehicle?.color||'';
 $('passwordSettingsForm').reset();$('emailSettingsForm').reset();
}
$('settingsBtn').onclick=()=>{populateSettingsForm();showOnly('settingsView')};
$('backToDashboard').onclick=()=>showOnly('driverView');

$('profileSettingsForm').onsubmit=async e=>{
 e.preventDefault();clear('profileSettingsError');clear('profileSettingsSuccess');
 const fd=new FormData(e.currentTarget);
 const name=String(fd.get('name')||'').trim(),phone=String(fd.get('phone')||'').trim(),zone=fd.get('current_zone');
 if(!name){err('profileSettingsError',t('msg_name_required'));return}
 if(!validPhone(phone)){err('profileSettingsError',t('msg_phone_invalid'));return}
 const btn=e.currentTarget.querySelector('button[type="submit"]');const oldText=btn.textContent;btn.disabled=true;btn.textContent=t('generic_save_sending');
 try{
  const {error}=await sb.rpc('driver_update_profile',{p_name:name,p_phone:phone,p_current_zone:zone});
  if(error){err('profileSettingsError',error.message);return}
  await refreshDriver();
  $('profileSettingsSuccess').textContent=t('msg_profile_saved');$('profileSettingsSuccess').classList.remove('hidden');
 }catch(ex){err('profileSettingsError',ex.message||t('form_error_generic'))}
 finally{btn.disabled=false;btn.textContent=oldText}
};

$('vehicleSettingsForm').onsubmit=async e=>{
 e.preventDefault();clear('vehicleSettingsError');clear('vehicleSettingsSuccess');
 const fd=new FormData(e.currentTarget);
 const make=String(fd.get('make')||'').trim(),model=String(fd.get('model')||'').trim(),year=Number(fd.get('model_year')),color=String(fd.get('color')||'').trim();
 if(!make||!model||!color){err('vehicleSettingsError',t('msg_vehicle_required'));return}
 const btn=e.currentTarget.querySelector('button[type="submit"]');const oldText=btn.textContent;btn.disabled=true;btn.textContent=t('generic_save_sending');
 try{
  const {error}=await sb.rpc('driver_update_vehicle',{p_make:make,p_model:model,p_model_year:year,p_color:color});
  if(error){err('vehicleSettingsError',error.message);return}
  await refreshDriver();
  $('vehicleSettingsSuccess').textContent=t('msg_vehicle_saved');$('vehicleSettingsSuccess').classList.remove('hidden');
 }catch(ex){err('vehicleSettingsError',ex.message||t('form_error_generic'))}
 finally{btn.disabled=false;btn.textContent=oldText}
};

$('emailSettingsForm').onsubmit=async e=>{
 e.preventDefault();clear('emailSettingsError');clear('emailSettingsSuccess');
 const fd=new FormData(e.currentTarget);
 const newEmail=String(fd.get('new_email')||'').trim();
 const btn=e.currentTarget.querySelector('button[type="submit"]');const oldText=btn.textContent;btn.disabled=true;btn.textContent=t('generic_send_sending');
 try{
  const {error}=await sb.auth.updateUser({email:newEmail});
  if(error){err('emailSettingsError',error.message);return}
  $('emailSettingsSuccess').textContent=t('msg_email_sent');$('emailSettingsSuccess').classList.remove('hidden');
  e.currentTarget.reset();
 }catch(ex){err('emailSettingsError',ex.message||t('form_error_generic'))}
 finally{btn.disabled=false;btn.textContent=oldText}
};

$('passwordSettingsForm').onsubmit=async e=>{
 e.preventDefault();clear('passwordSettingsError');clear('passwordSettingsSuccess');
 const fd=new FormData(e.currentTarget);
 const p1=fd.get('new_password'),p2=fd.get('confirm_password');
 if(p1.length<8){err('passwordSettingsError',t('msg_password_short'));return}
 if(p1!==p2){err('passwordSettingsError',t('msg_password_mismatch'));return}
 const btn=e.currentTarget.querySelector('button[type="submit"]');const oldText=btn.textContent;btn.disabled=true;btn.textContent=t('generic_update_sending');
 try{
  const {error}=await sb.auth.updateUser({password:p1});
  if(error){err('passwordSettingsError',error.message);return}
  $('passwordSettingsSuccess').textContent=t('msg_password_updated');$('passwordSettingsSuccess').classList.remove('hidden');
  e.currentTarget.reset();
 }catch(ex){err('passwordSettingsError',ex.message||t('form_error_generic'))}
 finally{btn.disabled=false;btn.textContent=oldText}
};

document.addEventListener('mashwarlangchange',()=>{
 if(driver){renderDriver();renderOffers();renderRide()}
});

(async()=>{const {data}=await sb.auth.getSession();if(data.session)await routeUser();else showOnly('authView')})();
