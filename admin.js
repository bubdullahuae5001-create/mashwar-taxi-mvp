const cfg=window.APP_CONFIG||{},sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
let rides=[],drivers=[],vehicles=[],driverFilter='all',settings={},settingsDirty=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusText={new:'جديد',searching:'جاري البحث',accepted:'تم القبول',on_the_way:'في الطريق',arrived:'وصل',started:'الرحلة جارية',completed:'مكتمل',cancelled:'ملغي',approved:'معتمد',pending:'قيد المراجعة',rejected:'مرفوض',suspended:'موقوف',trial:'تجريبي',active:'نشط',expired:'منتهي'};
function badgeStatus(s){const cls=['approved','active','completed'].includes(s)?'ok':['pending','trial','new','searching'].includes(s)?'warn':'bad';return `<span class="status ${cls}">${esc(statusText[s]||s||'—')}</span>`}
async function assertAdmin(){const {data:u}=await sb.auth.getUser();if(!u.user)return false;const {data:p}=await sb.from('profiles').select('role').eq('user_id',u.user.id).maybeSingle();return p?.role==='admin'}
async function boot(){const {data}=await sb.auth.getSession();if(data.session&&await assertAdmin())showAdmin()}

$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').classList.add('hidden');const {error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error){$('loginError').textContent='بيانات الدخول غير صحيحة.';$('loginError').classList.remove('hidden');return}if(!(await assertAdmin())){await sb.auth.signOut();$('loginError').textContent='هذا الحساب ليس مديرًا.';$('loginError').classList.remove('hidden');return}showAdmin()};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};$('refreshBtn').onclick=loadAll;
async function showAdmin(){$('loginView').classList.add('hidden');$('adminView').classList.remove('hidden');normalizeAdminUI();await loadAll()}

function normalizeAdminUI(){
  // السائق لا يختفي بعد الاعتماد: نفتح "الكل" افتراضيًا.
  document.querySelectorAll('.subtab').forEach(b=>b.classList.remove('active'));
  const all=[...document.querySelectorAll('.subtab')].find(b=>b.dataset.driverFilter==='all');
  if(all)all.classList.add('active');

  // المؤشر القديم "المتاحون" كان يسبب التباسًا. نجعله "المعتمدون".
  const old=$('kpiAvailable');
  if(old){
    const card=old.closest('.kpi');
    const label=card?.querySelector('span');
    if(label)label.textContent='السائقون المعتمدون';
    const small=card?.querySelector('small');
    if(small)small.textContent='تم اعتماد حساباتهم';
    // نضيف مؤشرًا منفصلًا للمتاحين الآن بدون الحاجة لتعديل admin.html.
    if(!$('kpiOnline')&&card?.parentElement){
      const online=card.cloneNode(true);
      online.querySelector('span').textContent='المتاحون الآن';
      online.querySelector('strong').id='kpiOnline';
      online.querySelector('strong').textContent='0';
      online.querySelector('small').textContent='جاهزون لاستقبال الطلبات';
      card.parentElement.insertBefore(online,card.nextSibling);
    }
  }
}

function parseValue(v){if(v===true||v===false||typeof v==='number')return v;if(typeof v==='string'){if(v==='true')return true;if(v==='false')return false;if(/^-?\d+(\.\d+)?$/.test(v))return Number(v);return v.replace(/^"|"$/g,'')}return v}
async function loadAll(){
 const [r,d,v,s]=await Promise.all([sb.from('ride_requests').select('*').order('created_at',{ascending:false}),sb.from('drivers').select('*').order('created_at',{ascending:false}),sb.from('vehicles').select('*').order('created_at',{ascending:false}),sb.from('app_settings').select('key,value')]);
 if(r.error||d.error||v.error){alert((r.error||d.error||v.error).message);return}
 rides=r.data||[];drivers=d.data||[];vehicles=v.data||[];settings={};(s.data||[]).forEach(x=>settings[x.key]=parseValue(x.value));renderAll();
 if($('lastUpdated'))$('lastUpdated').textContent='آخر تحديث '+new Date().toLocaleTimeString('ar-AE',{hour:'2-digit',minute:'2-digit'});
}
function vehicleFor(id){return vehicles.find(v=>v.driver_id===id)}
function renderAll(){renderOverview();renderRides();renderDrivers();renderSubscriptions();renderSettings()}
function renderOverview(){
 const today=new Date();today.setHours(0,0,0,0);
 $('kpiToday').textContent=rides.filter(r=>new Date(r.created_at)>=today).length;
 $('kpiWaiting').textContent=rides.filter(r=>!r.driver_id&&['new','searching'].includes(r.status)).length;
 $('kpiAvailable').textContent=drivers.filter(d=>d.approval_status==='approved').length;
 if($('kpiOnline'))$('kpiOnline').textContent=drivers.filter(d=>d.approval_status==='approved'&&d.is_available&&!d.is_busy).length;
 $('kpiPending').textContent=drivers.filter(d=>d.approval_status==='pending').length;
 const issues=[];
 drivers.filter(d=>d.approval_status==='pending').slice(0,5).forEach(d=>issues.push(`<button class="attention" onclick="openView('drivers')"><span>سائق ينتظر الاعتماد</span><strong>${esc(d.name)}</strong></button>`));
 rides.filter(r=>!r.driver_id&&['new','searching'].includes(r.status)).slice(0,5).forEach(r=>issues.push(`<button class="attention" onclick="openView('rides')"><span>طلب بدون سائق</span><strong>${esc(r.order_number)} · ${esc(r.pickup)}</strong></button>`));
 $('attentionList').innerHTML=issues.join('')||'<div class="empty">لا توجد حالات تحتاج تدخلك الآن ✓</div>';
}
function renderRides(){const q=$('searchInput').value.trim().toLowerCase(),st=$('statusFilter').value,list=rides.filter(r=>(!st||r.status===st)&&(!q||String(r.order_number||'').toLowerCase().includes(q)||String(r.phone||'').includes(q)));$('ridesCount').textContent=list.length+' طلب';$('ridesCards').innerHTML=list.map(r=>{const d=drivers.find(x=>x.id===r.driver_id);return `<article class="entity-card"><div class="entity-top"><div><strong class="entity-title">${esc(r.order_number)}</strong><span class="entity-sub">${new Date(r.created_at).toLocaleString('ar-AE')}</span></div>${badgeStatus(r.status)}</div><div class="facts"><div><small>العميل</small><b>${esc(r.customer_name)}</b></div><div><small>الانطلاق</small><b>${esc(r.pickup)}</b></div><div><small>الوجهة</small><b>${esc(r.destination)}</b></div><div><small>السائق</small><b>${esc(d?.name||'توزيع تلقائي')}</b></div></div></article>`}).join('')||'<div class="empty">لا توجد طلبات.</div>'}
function renderDrivers(){const list=driverFilter==='all'?drivers:drivers.filter(d=>d.approval_status===driverFilter);$('driversCount').textContent=list.length+' سائق';$('driversCards').innerHTML=list.map(d=>{const v=vehicleFor(d.id);return `<article class="entity-card"><div class="entity-top"><div><strong class="entity-title">${esc(d.name)}</strong><span class="entity-sub" dir="ltr">${esc(d.phone)}</span></div>${badgeStatus(d.approval_status)}</div><div class="facts"><div><small>المركبة</small><b>${esc(v?`${v.make||''} ${v.model||''}`:(d.car_type||'—'))}</b></div><div><small>اللوحة</small><b>${esc(v?.plate_number||d.car_number||'—')}</b></div><div><small>اعتماد المركبة</small><b>${v?badgeStatus(v.approval_status):'—'}</b></div><div><small>حالة التشغيل</small><b>${d.is_busy?'🔴 مشغول':d.is_available?'🟢 متاح':'⚫ غير متاح'}</b></div><div><small>الاشتراك</small><b>${badgeStatus(d.subscription_status)}</b></div></div><div class="card-actions">${d.approval_status==='pending'?`<button class="btn btn-green" onclick="approveDriver('${d.id}','${v?.id||''}')">اعتماد السائق والمركبة</button><button class="btn btn-outline-danger" onclick="rejectDriver('${d.id}','${v?.id||''}')">رفض</button>`:''}${d.approval_status==='approved'?`<button class="btn btn-outline-danger" onclick="suspendDriver('${d.id}')">إيقاف مؤقت</button>`:''}${d.approval_status==='suspended'?`<button class="btn btn-green" onclick="restoreDriver('${d.id}')">إعادة التفعيل</button>`:''}</div></article>`}).join('')||'<div class="empty">لا يوجد سائقون في هذه الفئة.</div>'}
function renderSubscriptions(){$('subscriptionCards').innerHTML=drivers.map(d=>`<article class="entity-card compact-card"><div class="entity-top"><div><strong class="entity-title">${esc(d.name)}</strong><span class="entity-sub">${d.trial_ends_at?'التجربة حتى '+new Date(d.trial_ends_at).toLocaleDateString('ar-AE'):''}</span></div>${badgeStatus(d.subscription_status)}</div><div class="card-actions"><button class="btn btn-yellow" onclick="activateMonth('${d.id}')">تفعيل 30 يومًا</button></div></article>`).join('')}
function renderSettings(){document.querySelectorAll('[data-setting]').forEach(x=>x.checked=!!settings[x.dataset.setting]);document.querySelectorAll('[data-setting-number]').forEach(x=>x.value=settings[x.dataset.settingNumber]??'');const m=settings.operating_mode||'test';document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));if($('modeTitle'))$('modeTitle').textContent=m==='live'?'التشغيل الفعلي':'وضع التجربة';if($('settingsStateBadge'))$('settingsStateBadge').textContent=m==='live'?'● تشغيل فعلي':'● وضع التجربة';settingsDirty=false;updateDirty()}
function updateDirty(){if($('settingsDirtyText'))$('settingsDirtyText').textContent=settingsDirty?'لديك تغييرات غير محفوظة':'لا توجد تغييرات غير محفوظة';if($('saveSettingsBtn'))$('saveSettingsBtn').disabled=!settingsDirty}
document.querySelectorAll('[data-setting],[data-setting-number]').forEach(x=>x.addEventListener('change',()=>{settingsDirty=true;updateDirty()}));document.querySelectorAll('.mode-btn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.mode-btn').forEach(x=>x.classList.toggle('active',x===b));settingsDirty=true;updateDirty()});
if($('saveSettingsBtn'))$('saveSettingsBtn').onclick=async()=>{const changes={operating_mode:document.querySelector('.mode-btn.active')?.dataset.mode||'test'};document.querySelectorAll('[data-setting]').forEach(x=>changes[x.dataset.setting]=x.checked);document.querySelectorAll('[data-setting-number]').forEach(x=>changes[x.dataset.settingNumber]=Number(x.value));for(const [k,v] of Object.entries(changes)){const {error}=await sb.rpc('admin_set_app_setting',{p_key:k,p_value:v});if(error)return alert('تعذر الحفظ: '+error.message)}settings={...settings,...changes};renderSettings();alert('تم حفظ الإعدادات.')};
$('searchInput').oninput=renderRides;$('statusFilter').onchange=renderRides;document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>openView(b.dataset.view));window.openView=n=>{document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===n));document.querySelectorAll('.view-section').forEach(v=>v.classList.add('hidden'));$(n+'View').classList.remove('hidden')};
document.querySelectorAll('.subtab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.subtab').forEach(x=>x.classList.remove('active'));b.classList.add('active');driverFilter=b.dataset.driverFilter;renderDrivers()});
window.approveDriver=async(id,vid)=>{if(!confirm('اعتماد السائق والمركبة؟'))return;const {error}=await sb.rpc('admin_set_driver_status',{p_driver_id:id,p_status:'approved',p_vehicle_id:vid||null,p_reason:null});if(error)return alert(error.message);driverFilter='all';normalizeAdminUI();await loadAll()};
window.rejectDriver=async(id,vid)=>{const reason=prompt('سبب الرفض:');if(reason===null)return;const {error}=await sb.rpc('admin_set_driver_status',{p_driver_id:id,p_status:'rejected',p_vehicle_id:vid||null,p_reason:reason});if(error)return alert(error.message);await loadAll()};
window.suspendDriver=async id=>{const reason=prompt('سبب الإيقاف المؤقت:');if(reason===null)return;const {error}=await sb.rpc('admin_set_driver_status',{p_driver_id:id,p_status:'suspended',p_vehicle_id:null,p_reason:reason});if(error)return alert(error.message);await loadAll()};
window.restoreDriver=async id=>{const {error}=await sb.rpc('admin_set_driver_status',{p_driver_id:id,p_status:'approved',p_vehicle_id:null,p_reason:'إعادة تفعيل'});if(error)return alert(error.message);await loadAll()};
window.activateMonth=async id=>{const {error}=await sb.rpc('admin_activate_subscription',{p_driver_id:id,p_days:30});if(error)return alert(error.message);await loadAll()};
boot();
