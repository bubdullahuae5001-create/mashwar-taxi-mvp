const cfg=window.APP_CONFIG||{},sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
let rides=[],drivers=[],vehicles=[],driverFilter='all',selectedRideId=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={new:'جديد',searching:'جاري البحث',accepted:'تم القبول',on_the_way:'في الطريق',arrived:'وصل',started:'الرحلة جارية',completed:'مكتمل',cancelled:'ملغي',approved:'معتمد',pending:'قيد المراجعة',rejected:'مرفوض',suspended:'موقوف',trial:'تجريبي',active:'نشط',expired:'منتهي'};
function badge(s){const c=['approved','active','completed'].includes(s)?'ok':['pending','trial','new','searching'].includes(s)?'warn':'bad';return `<span class="status ${c}">${esc(labels[s]||s||'—')}</span>`}
function vehicleFor(id){return vehicles.find(v=>v.driver_id===id)}
function date(v){return v?new Date(v).toLocaleDateString('ar-AE'):'—'}
function datetime(v){return v?new Date(v).toLocaleString('ar-AE',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):null}
async function isAdmin(){const {data:u}=await sb.auth.getUser();if(!u.user)return false;const {data:p}=await sb.from('profiles').select('role').eq('user_id',u.user.id).maybeSingle();return p?.role==='admin'}
async function boot(){const {data}=await sb.auth.getSession();if(data.session&&await isAdmin())showAdmin()}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').classList.add('hidden');const {error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error||!(await isAdmin())){await sb.auth.signOut();$('loginError').textContent=error?'بيانات الدخول غير صحيحة.':'هذا الحساب ليس مديرًا.';$('loginError').classList.remove('hidden');return}showAdmin()};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};$('refreshBtn').onclick=loadAll;
async function showAdmin(){$('loginView').classList.add('hidden');$('adminView').classList.remove('hidden');await loadAll()}
async function loadAll(){const [r,d,v]=await Promise.all([sb.from('ride_requests').select('*').order('created_at',{ascending:false}),sb.from('drivers').select('*').order('created_at',{ascending:false}),sb.from('vehicles').select('*').order('created_at',{ascending:false})]);if(r.error||d.error||v.error)return alert((r.error||d.error||v.error).message);rides=r.data||[];drivers=d.data||[];vehicles=v.data||[];renderAll();$('lastUpdated').textContent='آخر تحديث '+new Date().toLocaleTimeString('ar-AE',{hour:'2-digit',minute:'2-digit'})}
function renderAll(){renderOverview();renderRides();renderDrivers();renderSubscriptions()}
function renderOverview(){const t=new Date();t.setHours(0,0,0,0);$('kpiToday').textContent=rides.filter(r=>new Date(r.created_at)>=t).length;$('kpiWaiting').textContent=rides.filter(r=>!r.driver_id&&['new','searching'].includes(r.status)).length;$('kpiAvailable').textContent=drivers.filter(d=>d.approval_status==='approved').length;$('kpiOnline').textContent=drivers.filter(d=>d.approval_status==='approved'&&d.is_available&&!d.is_busy).length;$('kpiPending').textContent=drivers.filter(d=>d.approval_status==='pending').length;const a=[];drivers.filter(d=>d.approval_status==='pending').slice(0,5).forEach(d=>a.push(`<button class="attention" onclick="openView('drivers')"><b>سائق ينتظر الاعتماد</b><br>${esc(d.name)}</button>`));rides.filter(r=>!r.driver_id&&['new','searching'].includes(r.status)).slice(0,5).forEach(r=>a.push(`<button class="attention" onclick="openView('rides');selectRide('${r.id}')"><b>طلب لم يجد سائقًا بعد</b><br>${esc(r.order_number)} · ${esc(r.pickup)}</button>`));$('attentionList').innerHTML=a.join('')||'<div class="empty">لا توجد حالات تحتاج تدخل الإدارة الآن.</div>'}

/* ===== الطلبات: قائمة + بطاقة تفصيلية ===== */
function renderRides(){
 const q=$('searchInput').value.trim().toLowerCase(),s=$('statusFilter').value,
  list=rides.filter(r=>(!s||r.status===s)&&(!q||String(r.order_number).toLowerCase().includes(q)||String(r.phone).includes(q)));
 $('ridesCount').textContent=list.length+' طلب';
 $('ridesList').innerHTML=list.map(r=>{
  const d=drivers.find(x=>x.id===r.driver_id);
  return `<button class="ride-row${r.id===selectedRideId?' active':''}" onclick="selectRide('${r.id}')">
   <div class="top"><b>${esc(r.order_number)}</b>${badge(r.status)}</div>
   <div class="route">${esc(r.pickup)} ← ${esc(r.destination)}</div>
   <div class="meta">${esc(d?.name||'توزيع تلقائي')} · ${date(r.created_at)}</div>
  </button>`;
 }).join('')||'<div class="empty">لا توجد طلبات مطابقة.</div>';
 if(selectedRideId&&!list.some(r=>r.id===selectedRideId))selectedRideId=null;
 if(!selectedRideId&&list.length)selectedRideId=list[0].id;
 renderRideDetail();
}
window.selectRide=id=>{selectedRideId=id;renderRides()};
function renderRideDetail(){
 const box=$('ridesDetail');
 const r=rides.find(x=>x.id===selectedRideId);
 if(!r){box.innerHTML='<div class="empty">اختر طلبًا من القائمة لعرض تفاصيله.</div>';return}
 const d=drivers.find(x=>x.id===r.driver_id),v=d?vehicleFor(d.id):null;
 const driverHtml=d?`<div class="dsection"><h3>السائق</h3><div class="dgrid">
   <div><span>الاسم</span><b>${esc(d.name)}</b></div><div><span>الهاتف</span><b dir="ltr">${esc(d.phone||'—')}</b></div>
   <div><span>المركبة</span><b>${esc(v?`${v.make||''} ${v.model||''}`.trim():'—')}</b></div><div><span>رقم اللوحة</span><b>${esc(v?.plate_number||'—')}</b></div>
  </div></div>`:`<div class="dsection"><h3>السائق</h3><div class="dgrid"><div style="grid-column:1/-1;text-align:center;color:#98a2b3">لم يُعيّن سائق بعد</div></div></div>`;
 const steps=[
  ['تم استلام الطلب',r.created_at],
  ['تم قبول الطلب',r.accepted_at],
  ['وصل السائق',r.arrived_at],
  ['بدأت الرحلة',r.started_at],
  ['اكتملت الرحلة',r.completed_at],
 ];
 const timelineHtml=steps.map(([label,ts])=>`<div class="dtstep"><div class="dot${ts?'':' pending'}"></div><div><b>${label}</b><small>${ts?datetime(ts):'لم تحدث بعد'}</small></div></div>`).join('');
 const stuck=!r.driver_id&&['new','searching'].includes(r.status);
 const actionsHtml=stuck?`<div class="detail-actions"><button class="btn danger" onclick="cancelRide('${r.id}')">إلغاء الطلب</button><button class="btn ghost" onclick="retryDispatch('${r.id}')">إعادة محاولة التوزيع الآن</button></div>`
  :(r.status==='cancelled'?'':`<div class="detail-actions"><button class="btn ghost" onclick="cancelRide('${r.id}')">إلغاء الطلب</button></div>`);
 box.innerHTML=`
  <div class="detail-top"><div><h2>طلب ${esc(r.order_number)}</h2><p>تم الإنشاء: ${datetime(r.created_at)}</p></div>${badge(r.status)}</div>
  <div class="dsection"><h3>بيانات العميل</h3><div class="dgrid">
   <div><span>الاسم</span><b>${esc(r.customer_name)}</b></div><div><span>الهاتف</span><b dir="ltr">${esc(r.phone)}</b></div>
   <div><span>الانطلاق</span><b>${esc(r.pickup)}</b></div><div><span>الوجهة</span><b>${esc(r.destination)}</b></div>
   <div><span>المنطقة</span><b>${esc(r.pickup_zone||'—')}</b></div><div><span>الملاحظات</span><b>${esc(r.notes||'—')}</b></div>
  </div></div>
  ${driverHtml}
  <div class="dsection"><h3>الخط الزمني</h3><div class="dtimeline">${timelineHtml}</div></div>
  ${actionsHtml}
 `;
}
window.cancelRide=async id=>{
 if(!confirm('تأكيد إلغاء هذا الطلب؟'))return;
 const {error}=await sb.rpc('admin_cancel_ride',{p_ride_id:id});
 if(error)return alert(error.message);
 await loadAll();
};
window.retryDispatch=async id=>{
 const {error}=await sb.rpc('dispatch_ride',{p_ride_id:id});
 if(error)return alert(error.message);
 await loadAll();
};

function renderDrivers(){const list=driverFilter==='all'?drivers:drivers.filter(d=>d.approval_status===driverFilter);$('driversCount').textContent=list.length+' سائق';$('driversRows').innerHTML=list.map(d=>{const v=vehicleFor(d.id),approved=d.approval_status==='approved'&&v?.approval_status==='approved';let actions=approved?`<button disabled>معتمد</button><button onclick="showDriver('${d.id}')">التفاصيل</button><button class="reject" onclick="suspendDriver('${d.id}')">إيقاف مؤقت</button>`:d.approval_status==='pending'?`<button class="approve" onclick="approveDriver('${d.id}','${v?.id||''}')">اعتماد</button><button onclick="showDriver('${d.id}')">التفاصيل</button><button onclick="editDriver('${d.id}')">تعديل</button><button class="reject" onclick="rejectDriver('${d.id}','${v?.id||''}')">رفض</button>`:`<button onclick="showDriver('${d.id}')">التفاصيل</button><button onclick="editDriver('${d.id}')">تعديل</button>${d.approval_status==='suspended'?`<button class="approve" onclick="restoreDriver('${d.id}')">إعادة التفعيل</button>`:''}`;return `<tr><td><div class="person"><strong>${esc(d.name)}</strong><small>${esc(d.current_zone||'—')}</small></div></td><td><b>${esc(v?.plate_number||d.car_number||'—')}</b></td><td dir="ltr">${esc(d.phone||'—')}</td><td>${esc(v?`${v.make||''} ${v.model||''}`:d.car_type||'—')}</td><td>${badge(d.approval_status)} ${v?badge(v.approval_status):badge('pending')}</td><td><div class="row-actions">${actions}</div></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">لا يوجد سائقون.</td></tr>'}
function renderSubscriptions(){$('subscriptionRows').innerHTML=drivers.map(d=>{const end=d.subscription_status==='trial'?d.trial_ends_at:d.subscription_ends_at,days=end?Math.ceil((new Date(end)-new Date())/86400000):null;return `<tr><td><b>${esc(d.name)}</b></td><td dir="ltr">${esc(d.phone||'—')}</td><td>${badge(d.subscription_status)}</td><td>${date(end)}</td><td class="${days!==null&&days<=7?'days-low':''}">${days===null?'—':days<0?'منتهي':days+' يوم'}</td><td><div class="row-actions"><button class="approve" onclick="activateMonth('${d.id}')">تفعيل 30 يومًا</button><button onclick="showDriver('${d.id}')">التفاصيل</button></div></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">لا توجد اشتراكات.</td></tr>'}
function details(items){return `<div class="detail-grid">${items.map(([a,b])=>`<div><small>${a}</small><b>${esc(b??'—')}</b></div>`).join('')}</div>`}
window.showDriver=id=>{const d=drivers.find(x=>x.id===id),v=vehicleFor(id);$('detailTitle').textContent='ملف السائق';$('detailBody').innerHTML=details([['الاسم',d.name],['الهاتف',d.phone],['المنطقة',d.current_zone],['حالة السائق',labels[d.approval_status]],['رقم اللوحة',v?.plate_number],['المركبة',v?`${v.make||''} ${v.model||''}`:d.car_type],['سنة الصنع',v?.model_year],['حالة المركبة',labels[v?.approval_status]],['الاشتراك',labels[d.subscription_status]],['نهاية التجربة',date(d.trial_ends_at)]]);$('detailActions').innerHTML=`<button class="btn ghost" onclick="detailDialog.close()">إغلاق</button>`;$('detailDialog').showModal()}
window.editDriver=async id=>{const d=drivers.find(x=>x.id===id),v=vehicleFor(id),name=prompt('اسم السائق:',d.name||'');if(name===null)return;const phone=prompt('رقم الهاتف:',d.phone||'');if(phone===null)return;const plate=prompt('رقم السيارة/اللوحة:',v?.plate_number||'');if(plate===null)return;const a=await sb.from('drivers').update({name:name.trim(),phone:phone.trim()}).eq('id',id);if(a.error)return alert(a.error.message);if(v){const b=await sb.from('vehicles').update({plate_number:plate.trim()}).eq('id',v.id);if(b.error)return alert(b.error.message)}await loadAll()}
window.approveDriver=async(id,vid)=>{if(!vid)return alert('لا يمكن الاعتماد قبل وجود مركبة مرتبطة بالسائق.');if(!confirm('اعتماد السائق والمركبة؟'))return;const {error}=await sb.rpc('admin_set_driver_status',{p_driver_id:id,p_status:'approved',p_vehicle_id:vid,p_reason:null});if(error)return alert(error.message);await loadAll()}
window.rejectDriver=async(id,vid)=>{const reason=prompt('سبب الرفض (إلزامي):');if(!reason?.trim())return alert('يجب كتابة سبب الرفض.');const {error}=await sb.rpc('admin_set_driver_status',{p_driver_id:id,p_status:'rejected',p_vehicle_id:vid||null,p_reason:reason.trim()});if(error)return alert(error.message);await loadAll()}
window.suspendDriver=async id=>{const reason=prompt('سبب الإيقاف المؤقت (إلزامي):');if(!reason?.trim())return alert('يجب كتابة سبب الإيقاف.');const {error}=await sb.rpc('admin_set_driver_status',{p_driver_id:id,p_status:'suspended',p_vehicle_id:null,p_reason:reason.trim()});if(error)return alert(error.message);await loadAll()}
window.restoreDriver=async id=>{if(!confirm('إعادة تفعيل السائق؟'))return;const {error}=await sb.rpc('admin_set_driver_status',{p_driver_id:id,p_status:'approved',p_vehicle_id:null,p_reason:'إعادة تفعيل'});if(error)return alert(error.message);await loadAll()}
window.activateMonth=async id=>{if(!confirm('تفعيل الاشتراك لمدة 30 يومًا؟'))return;const {error}=await sb.rpc('admin_activate_subscription',{p_driver_id:id,p_days:30});if(error)return alert(error.message);await loadAll()}
window.openView=n=>{document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===n));document.querySelectorAll('.view-section').forEach(v=>v.classList.add('hidden'));$(n+'View').classList.remove('hidden')};document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>openView(b.dataset.view));document.querySelectorAll('.subtab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.subtab').forEach(x=>x.classList.remove('active'));b.classList.add('active');driverFilter=b.dataset.driverFilter;renderDrivers()});$('searchInput').oninput=renderRides;$('statusFilter').onchange=renderRides;boot();
