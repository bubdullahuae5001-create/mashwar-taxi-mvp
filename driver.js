const cfg = window.APP_CONFIG || {};

const sb = supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

let driver = null;
let activeRide = null;
let pollingTimer = null;


/* =========================
   HELPERS
========================= */

function showError(id, message){
  const box = $(id);
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError(id){
  $(id).classList.add('hidden');
}

function esc(value=''){
  return String(value).replace(/[&<>'"]/g, char => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[char]));
}

function waPhone(phone){
  let p = String(phone || '').replace(/\D/g,'');

  if(p.startsWith('0')){
    p = '971' + p.slice(1);
  }

  if(!p.startsWith('971')){
    p = '971' + p;
  }

  return p;
}

function approvalLabel(status){

  const map = {
    pending:'قيد المراجعة',
    approved:'معتمد',
    rejected:'مرفوض',
    suspended:'موقوف'
  };

  return map[status] || status || '—';
}

function subscriptionLabel(status){

  const map = {
    trial:'تجريبي',
    active:'نشط',
    expired:'منتهي'
  };

  return map[status] || status || '—';
}


/* =========================
   TABS
========================= */

$('loginTab').onclick = () => {

  $('loginForm').classList.remove('hidden');
  $('registerForm').classList.add('hidden');

  $('loginTab').classList.add('active');
  $('registerTab').classList.remove('active');
};


$('registerTab').onclick = () => {

  $('registerForm').classList.remove('hidden');
  $('loginForm').classList.add('hidden');

  $('registerTab').classList.add('active');
  $('loginTab').classList.remove('active');
};


/* =========================
   REGISTER DRIVER
========================= */

$('registerForm').onsubmit = async event => {

  event.preventDefault();

  hideError('registerError');

  const formData = new FormData(event.currentTarget);


  const metadata = {

    account_type:'driver',

    full_name:
      formData
        .get('full_name')
        .trim(),

    phone:
      formData
        .get('phone')
        .trim(),

    driving_license_no:
      formData
        .get('driving_license_no')
        .trim(),

    driving_license_expiry:
      formData
        .get('driving_license_expiry'),

    taxi_permit_no:
      formData
        .get('taxi_permit_no')
        .trim(),

    current_zone:
      formData
        .get('current_zone'),

    plate_number:
      formData
        .get('plate_number')
        .trim(),

    plate_emirate:
      formData
        .get('plate_emirate'),

    vehicle_make:
      formData
        .get('vehicle_make')
        .trim(),

    vehicle_model:
      formData
        .get('vehicle_model')
        .trim(),

    model_year:
      formData
        .get('model_year'),

    vehicle_color:
      formData
        .get('vehicle_color')
        .trim(),

    registration_expiry:
      formData
        .get('registration_expiry'),

    insurance_expiry:
      formData
        .get('insurance_expiry')

  };


  const email =
    formData
      .get('email')
      .trim();


  const password =
    formData
      .get('password');


  const {
    data,
    error
  } = await sb.auth.signUp({

    email,

    password,

    options:{
      data:metadata
    }

  });


  if(error){

    showError(
      'registerError',
      error.message
    );

    return;
  }


  event.currentTarget.reset();


  if(data.session){

    alert(
      'تم إنشاء الحساب بنجاح. الحساب الآن قيد المراجعة.'
    );

    await showDriver();

  }else{

    alert(
      'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجل الدخول.'
    );

    $('loginTab').click();
  }

};


/* =========================
   LOGIN
========================= */

$('loginForm').onsubmit = async event => {

  event.preventDefault();

  hideError('loginError');


  const email =
    $('loginEmail')
      .value
      .trim();


  const password =
    $('loginPassword')
      .value;


  const {
    error
  } = await sb.auth.signInWithPassword({

    email,
    password

  });


  if(error){

    showError(
      'loginError',
      'بيانات الدخول غير صحيحة أو البريد الإلكتروني غير مؤكد.'
    );

    return;
  }


  await showDriver();

};


/* =========================
   LOGOUT
========================= */

$('logoutBtn').onclick = async () => {

  if(pollingTimer){
    clearInterval(pollingTimer);
  }

  await sb.auth.signOut();

  location.reload();
};


/* =========================
   DRIVER DASHBOARD
========================= */

async function showDriver(){

  $('authView').classList.add('hidden');

  $('driverView').classList.remove('hidden');


  await loadDriverData();


  pollingTimer = setInterval(
    async () => {

      try{

        await sb.rpc(
          'refresh_dispatches'
        );

        await loadDriverData(
          false
        );

      }catch(error){

        console.error(error);

      }

    },
    10000
  );

}


/* =========================
   LOAD DRIVER
========================= */

async function loadDriverData(showAlert=true){

  const {
    data:userData
  } = await sb.auth.getUser();


  const user =
    userData.user;


  if(!user){
    return;
  }


  const {
    data,
    error
  } = await sb
    .from('drivers')
    .select('*')
    .eq(
      'user_id',
      user.id
    )
    .single();


  if(error){

    if(showAlert){

      alert(
        'لم يتم العثور على ملف السائق.'
      );

    }

    return;
  }


  driver = data;


  $('driverHello').textContent =
    `مرحبًا ${driver.name}`;


  $('approvalStat').textContent =
    approvalLabel(
      driver.approval_status
    );


  if(
    driver.subscription_status ===
    'trial'
  ){

    $('subscriptionStat').textContent =
      'تجربة حتى ' +
      new Date(
        driver.trial_ends_at
      ).toLocaleDateString(
        'ar-AE'
      );

  }else{

    $('subscriptionStat').textContent =
      subscriptionLabel(
        driver.subscription_status
      );

  }


  if(driver.is_busy){

    $('availabilityStat').textContent =
      'في رحلة';

  }else if(driver.is_available){

    $('availabilityStat').textContent =
      'متاح';

  }else{

    $('availabilityStat').textContent =
      'غير متاح';

  }


  $('availabilityBtn').textContent =
    driver.is_available
      ? 'إيقاف استقبال الطلبات'
      : 'أصبح متاحًا';


  if(driver.current_zone){

    $('zoneSelect').value =
      driver.current_zone;
  }


  await Promise.all([
    loadOffers(),
    loadActiveRide()
  ]);

}


/* =========================
   AVAILABILITY
========================= */

$('availabilityBtn').onclick = async () => {

  const newAvailability =
    !driver.is_available;


  const {
    error
  } = await sb.rpc(
    'set_driver_availability',
    {

      p_available:
        newAvailability,

      p_zone:
        $('zoneSelect').value

    }
  );


  if(error){

    alert(
      error.message
    );

    return;
  }


  await loadDriverData();

};


/* =========================
   REFRESH
========================= */

$('refreshBtn').onclick =
  async () => {

    await sb.rpc(
      'refresh_dispatches'
    );

    await loadDriverData();

  };


/* =========================
   OFFERS
========================= */

async function loadOffers(){

  const {
    data,
    error
  } = await sb
    .from('ride_offers')
    .select(`
      id,
      ride_id,
      offer_status,
      expires_at,
      ride_requests (*)
    `)
    .eq(
      'driver_id',
      driver.id
    )
    .eq(
      'offer_status',
      'offered'
    )
    .gt(
      'expires_at',
      new Date().toISOString()
    )
    .order(
      'offered_at',
      {
        ascending:false
      }
    );


  if(error){

    console.error(error);

    return;
  }


  const offers =
    data || [];


  renderOffers(
    offers
  );

}


/* =========================
   RENDER OFFERS
========================= */

function renderOffers(offers){

  if(!offers.length){

    $('offers').innerHTML = `

      <div class="empty-state">

        <span>🚕</span>

        <strong>
          لا توجد طلبات جديدة
        </strong>

        <p>
          عند وصول طلب مناسب في منطقتك
          سيظهر هنا تلقائيًا.
        </p>

      </div>

    `;

    return;
  }


  $('offers').innerHTML =
    offers
      .map(offer => {

        const ride =
          offer.ride_requests;


        return `

          <article class="ride-card">

            <strong>
              طلب جديد
              ${esc(
                ride.order_number
              )}
            </strong>


            <div class="ride-grid">

              <div>
                الانطلاق

                <b>
                  ${esc(
                    ride.pickup
                  )}
                </b>
              </div>


              <div>
                الوجهة

                <b>
                  ${esc(
                    ride.destination
                  )}
                </b>
              </div>


              <div>
                منطقة الانطلاق

                <b>
                  ${esc(
                    ride.pickup_zone ||
                    '—'
                  )}
                </b>
              </div>


              <div>
                عدد الركاب

                <b>
                  ${ride.passengers}
                </b>
              </div>

            </div>


            <div class="ride-actions">

              <button
                class="driver-primary-btn"
                onclick="
                  acceptRide(
                    '${ride.id}'
                  )
                "
              >
                قبول الطلب
              </button>

            </div>

          </article>

        `;

      })
      .join('');

}


/* =========================
   ACCEPT RIDE
========================= */

window.acceptRide =
async rideId => {

  const {
    error
  } = await sb.rpc(
    'accept_ride',
    {
      p_ride_id:
        rideId
    }
  );


  if(error){

    alert(
      error.message
    );

    await loadDriverData();

    return;
  }


  alert(
    'تم قبول الطلب بنجاح.'
  );


  await loadDriverData();

};


/* =========================
   ACTIVE RIDE
========================= */

async function loadActiveRide(){

  const {
    data,
    error
  } = await sb
    .from(
      'ride_requests'
    )
    .select('*')
    .eq(
      'driver_id',
      driver.id
    )
    .in(
      'status',
      [
        'accepted',
        'on_the_way',
        'arrived',
        'started'
      ]
    )
    .order(
      'accepted_at',
      {
        ascending:false
      }
    )
    .limit(1);


  if(error){

    console.error(error);

    return;
  }


  activeRide =
    data?.[0] || null;


  renderActiveRide();

}


/* =========================
   RENDER ACTIVE RIDE
========================= */

function renderActiveRide(){

  if(!activeRide){

    $('activeRide').innerHTML = `

      <div class="empty-state">

        <span>✓</span>

        <strong>
          لا توجد رحلة حالية
        </strong>

      </div>

    `;

    return;
  }


  const ride =
    activeRide;


  const whatsapp =
    waPhone(
      ride.phone
    );


  const nextStep = {

    accepted:[
      'on_the_way',
      'في الطريق إلى العميل'
    ],

    on_the_way:[
      'arrived',
      'وصلت إلى العميل'
    ],

    arrived:[
      'started',
      'بدء الرحلة'
    ],

    started:[
      'completed',
      'إنهاء الرحلة'
    ]

  }[ride.status];


  $('activeRide').innerHTML = `

    <article class="ride-card">

      <strong>
        ${esc(
          ride.order_number
        )}
      </strong>


      <div class="ride-grid">

        <div>
          العميل

          <b>
            ${esc(
              ride.customer_name
            )}
          </b>
        </div>


        <div>
          الهاتف

          <b dir="ltr">
            ${esc(
              ride.phone
            )}
          </b>
        </div>


        <div>
          الانطلاق

          <b>
            ${esc(
              ride.pickup
            )}
          </b>
        </div>


        <div>
          الوجهة

          <b>
            ${esc(
              ride.destination
            )}
          </b>
        </div>

      </div>


      <div class="ride-actions">

        <a
          class="driver-secondary-btn"
          href="tel:${esc(
            ride.phone
          )}"
        >
          اتصال بالعميل
        </a>


        <a
          class="driver-secondary-btn"
          target="_blank"
          href="
            https://wa.me/${whatsapp}
          "
        >
          واتساب
        </a>


        ${
          nextStep
          ? `

            <button
              class="driver-primary-btn"
              onclick="
                updateRideStatus(
                  '${ride.id}',
                  '${nextStep[0]}'
                )
              "
            >
              ${nextStep[1]}
            </button>

          `
          : ''
        }

      </div>

    </article>

  `;

}


/* =========================
   UPDATE RIDE STATUS
========================= */

window.updateRideStatus =
async (
  rideId,
  status
) => {

  const {
    error
  } = await sb.rpc(
    'driver_update_ride_status',
    {

      p_ride_id:
        rideId,

      p_status:
        status

    }
  );


  if(error){

    alert(
      error.message
    );

    return;
  }


  await loadDriverData();

};


/* =========================
   INITIAL LOAD
========================= */

async function boot(){

  const {
    data
  } = await sb.auth.getSession();


  if(data.session){

    await showDriver();

  }

}


boot();
