const cfg=window.APP_CONFIG||{};
const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const booking=$('bookingDialog'),form=$('rideForm'),confirmDialog=$('confirmDialog'),success=$('successDialog');
let pending=null;

function normPhone(v){let p=String(v||'').replace(/\D/g,'');if(p.startsWith('00971'))p='0'+p.slice(5);else if(p.startsWith('971'))p='0'+p.slice(3);return p}
function validPhone(v){return /^05\d{8}$/.test(normPhone(v))}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function orderNo(){const d=new Date(),rnd=crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,5).toUpperCase();return `R${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${rnd}`}

/* ===== طلبك الأخير ===== */
function getLastOrder(){
 try{const raw=localStorage.getItem('mashwar_last_order');if(!raw)return null;const parsed=JSON.parse(raw);return parsed&&parsed.order?parsed:null}
 catch(e){return null}
}
function refreshLastOrderBar(){
 const bar=$('lastOrderBar');if(!bar)return;
 const last=getLastOrder();
 if(!last){bar.classList.add('hidden');return}
 if(sessionStorage.getItem('mashwar_last_order_dismissed')===last.order){bar.classList.add('hidden');return}
 $('lastOrderText').innerHTML=`${esc(t('lastOrderPrefix'))} <b id="lastOrderNumber">${esc(last.order)}</b>`;
 $('lastOrderTrack').textContent=t('lastOrderTrack');
 $('lastOrderTrack').href=`track.html?order=${encodeURIComponent(last.order)}&phone=${encodeURIComponent(last.phone||'')}`;
 bar.classList.remove('hidden');
}
if($('lastOrderClose'))$('lastOrderClose').onclick=()=>{const last=getLastOrder();if(last)sessionStorage.setItem('mashwar_last_order_dismissed',last.order);$('lastOrderBar').classList.add('hidden')};
refreshLastOrderBar();
document.addEventListener('mashwarlangchange',refreshLastOrderBar);

$('openBooking').onclick=()=>booking.showModal();
$('closeBooking').onclick=()=>booking.close();
form.timeType.onchange=()=>{$('laterWrap').classList.toggle('hidden',form.timeType.value!=='later');form.scheduledAt.required=form.timeType.value==='later'};

form.onsubmit=e=>{
 e.preventDefault();$('formError').classList.add('hidden');if(!form.reportValidity())return;
 const fd=new FormData(form),phone=normPhone(fd.get('phone')),type=fd.get('timeType');
 if(!validPhone(phone)){$('formError').textContent=t('form_error_phone');$('formError').classList.remove('hidden');return}
 const scheduled=type==='later'?new Date(fd.get('scheduledAt')):null;if(type==='later'&&(!scheduled||scheduled.getTime()<=Date.now())){$('formError').textContent=t('form_error_schedule');$('formError').classList.remove('hidden');return}
 pending={order_number:orderNo(),customer_name:String(fd.get('customerName')).trim(),phone,pickup:String(fd.get('pickup')).trim(),pickup_zone:fd.get('pickupZone'),destination:String(fd.get('destination')).trim(),request_type:type,scheduled_at:type==='later'?scheduled.toISOString():null,passengers:Number(fd.get('passengers')),notes:String(fd.get('notes')||'').trim()||null,status:'new'};
 const rows=[[t('lblName'),pending.customer_name],[t('lblPickup'),pending.pickup],[t('lblZone'),pending.pickup_zone],[t('lblDestination'),pending.destination],[t('lblPhone'),pending.phone],[t('lblPassengers'),pending.passengers]];
 $('summary').innerHTML=rows.map(([a,b])=>`<div class="summary-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');booking.close();confirmDialog.showModal();
};
$('editRequest').onclick=()=>{confirmDialog.close();booking.showModal()};
$('confirmRequest').onclick=async()=>{
 const btn=$('confirmRequest');btn.disabled=true;btn.textContent=t('sending');
 try{const {error}=await sb.from('ride_requests').insert(pending);if(error)throw error;$('orderNumber').textContent=pending.order_number;$('trackRequestLink').href=`track.html?order=${encodeURIComponent(pending.order_number)}&phone=${encodeURIComponent(pending.phone)}`;localStorage.setItem('mashwar_last_order',JSON.stringify({order:pending.order_number,phone:pending.phone}));sessionStorage.removeItem('mashwar_last_order_dismissed');refreshLastOrderBar();confirmDialog.close();success.showModal();form.reset();$('laterWrap').classList.add('hidden')}
 catch(err){alert(err.message||t('form_error_generic'))}
 finally{btn.disabled=false;btn.textContent=t('confirm_request')}
};
$('closeSuccess').onclick=()=>success.close();
