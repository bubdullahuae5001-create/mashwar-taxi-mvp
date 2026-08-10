const cfg = window.APP_CONFIG || {};
document.getElementById('appName').textContent = cfg.APP_NAME || 'مشوار';
document.title = `${cfg.APP_NAME || 'مشوار'} | اطلب سيارة بسهولة`;

const isConfigured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_PROJECT') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_');
const supabaseClient = isConfigured ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const form = document.getElementById('rideForm');
const confirmDialog = document.getElementById('confirmDialog');
const successDialog = document.getElementById('successDialog');
const summary = document.getElementById('summary');
const laterWrap = document.getElementById('laterWrap');
const scheduledAt = document.getElementById('scheduledAt');
const errorBox = document.getElementById('formError');
let pending = null;

function normalizePhone(v){ return v.replace(/[\s()-]/g,''); }
function validPhone(v){ return /^(?:\+971|00971|971|0)?5\d{8}$/.test(normalizePhone(v)); }
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function localDate(v){ return v ? new Date(v).toLocaleString('ar-AE',{dateStyle:'medium',timeStyle:'short'}) : 'الآن'; }
function orderNo(){ const d=new Date(); return `R${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`; }

form.timeType.forEach(r=>r.addEventListener('change',()=>{
  const later = form.timeType.value === 'later';
  laterWrap.classList.toggle('hidden', !later);
  scheduledAt.required = later;
  if(later){ const min=new Date(Date.now()+15*60000); min.setMinutes(min.getMinutes()-min.getTimezoneOffset()); scheduledAt.min=min.toISOString().slice(0,16); }
}));

form.addEventListener('submit',e=>{
  e.preventDefault(); errorBox.classList.add('hidden');
  const fd=new FormData(form);
  if(!form.reportValidity()) return;
  if(!validPhone(fd.get('phone'))){ errorBox.textContent='أدخل رقم هاتف إماراتي صحيح مثل 0501234567.'; errorBox.classList.remove('hidden'); return; }
  if(fd.get('timeType')==='later' && new Date(fd.get('scheduledAt')).getTime() <= Date.now()){
    errorBox.textContent='وقت الطلب اللاحق يجب أن يكون في المستقبل.'; errorBox.classList.remove('hidden'); return;
  }
  pending={
    order_number:orderNo(), customer_name:fd.get('customerName').trim(), phone:normalizePhone(fd.get('phone')),
    pickup:fd.get('pickup').trim(), destination:fd.get('destination').trim(), request_type:fd.get('timeType'),
    scheduled_at:fd.get('timeType')==='later' ? new Date(fd.get('scheduledAt')).toISOString() : null,
    passengers:Number(fd.get('passengers')), notes:fd.get('notes').trim() || null, status:'new'
  };
  const rows=[['الاسم',pending.customer_name],['الانطلاق',pending.pickup],['الوجهة',pending.destination],['الوقت',pending.request_type==='now'?'الآن':localDate(pending.scheduled_at)],['الهاتف',pending.phone],['الركاب',pending.passengers],['الملاحظات',pending.notes||'—']];
  summary.innerHTML=rows.map(([k,v])=>`<div class="summary-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
  confirmDialog.showModal();
});

document.getElementById('cancelConfirm').onclick=()=>confirmDialog.close();
document.getElementById('confirmRequest').onclick=async()=>{
  const btn=document.getElementById('confirmRequest'); btn.disabled=true; btn.textContent='جارٍ الإرسال...';
  try{
    if(!supabaseClient) throw new Error('لم يتم ربط Supabase بعد. انسخ config.example.js إلى config.js وأضف بيانات المشروع.');
    const {error}=await supabaseClient.from('ride_requests').insert(pending);
    if(error) throw error;
    confirmDialog.close(); document.getElementById('orderNumber').textContent=pending.order_number; successDialog.showModal(); form.reset(); laterWrap.classList.add('hidden');
  }catch(err){ alert(err.message || 'تعذر إرسال الطلب. حاول مرة أخرى.'); }
  finally{btn.disabled=false;btn.textContent='تأكيد الطلب';}
};
document.getElementById('newRequest').onclick=()=>successDialog.close();
