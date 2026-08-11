const cfg = window.APP_CONFIG || {};

document.getElementById('appName').textContent =
  cfg.APP_NAME || 'مشوار';

document.title =
  `${cfg.APP_NAME || 'مشوار'} | اطلب سيارة بسهولة`;


const supabaseClient =
  supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );


const form =
  document.getElementById('rideForm');

const confirmDialog =
  document.getElementById('confirmDialog');

const successDialog =
  document.getElementById('successDialog');

const summary =
  document.getElementById('summary');

const laterWrap =
  document.getElementById('laterWrap');

const scheduledAt =
  document.getElementById('scheduledAt');

const errorBox =
  document.getElementById('formError');


let pending = null;


/* =========================
   HELPERS
========================= */

function normalizePhone(value){

  return String(value || '')
    .replace(
      /[\s()-]/g,
      ''
    );

}


function validPhone(value){

  return /^(?:\+971|00971|971|0)?5\d{8}$/
    .test(
      normalizePhone(value)
    );

}


function escapeHtml(value=''){

  return String(value)
    .replace(
      /[&<>'"]/g,
      character => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        "'":'&#39;',
        '"':'&quot;'
      }[character])
    );

}


function localDate(value){

  return value
    ? new Date(value)
        .toLocaleString(
          'ar-AE',
          {
            dateStyle:'medium',
            timeStyle:'short'
          }
        )
    : 'الآن';

}


function createOrderNumber(){

  const date =
    new Date();


  return (
    'R' +
    String(
      date.getFullYear()
    ).slice(-2) +

    String(
      date.getMonth() + 1
    ).padStart(2,'0') +

    String(
      date.getDate()
    ).padStart(2,'0') +

    '-' +

    Math.random()
      .toString(36)
      .slice(2,7)
      .toUpperCase()
  );

}


/* =========================
   NOW / LATER
========================= */

form.timeType.forEach(
  radio => {

    radio.addEventListener(
      'change',
      () => {

        const later =
          form.timeType.value ===
          'later';


        laterWrap.classList.toggle(
          'hidden',
          !later
        );


        scheduledAt.required =
          later;


        if(later){

          const minimum =
            new Date(
              Date.now() +
              15 * 60000
            );


          minimum.setMinutes(
            minimum.getMinutes() -
            minimum.getTimezoneOffset()
          );


          scheduledAt.min =
            minimum
              .toISOString()
              .slice(0,16);

        }

      }
    );

  }
);


/* =========================
   FORM SUBMIT
========================= */

form.addEventListener(
  'submit',
  event => {

    event.preventDefault();


    errorBox.classList.add(
      'hidden'
    );


    const formData =
      new FormData(form);


    if(
      !form.reportValidity()
    ){

      return;

    }


    const phone =
      formData.get('phone');


    if(
      !validPhone(phone)
    ){

      errorBox.textContent =
        'أدخل رقم هاتف إماراتي صحيح مثل 0501234567.';


      errorBox.classList.remove(
        'hidden'
      );


      return;

    }


    const timeType =
      formData.get(
        'timeType'
      );


    if(
      timeType === 'later'
    ){

      const selectedTime =
        new Date(
          formData.get(
            'scheduledAt'
          )
        )
        .getTime();


      if(
        selectedTime <=
        Date.now()
      ){

        errorBox.textContent =
          'وقت الطلب اللاحق يجب أن يكون في المستقبل.';


        errorBox.classList.remove(
          'hidden'
        );


        return;

      }

    }


    /* =====================
       CREATE REQUEST
    ====================== */

    pending = {

      order_number:
        createOrderNumber(),

      customer_name:
        formData
          .get('customerName')
          .trim(),

      phone:
        normalizePhone(
          phone
        ),

      pickup:
        formData
          .get('pickup')
          .trim(),

      pickup_zone:
        formData
          .get('pickupZone'),

      destination:
        formData
          .get('destination')
          .trim(),

      request_type:
        timeType,

      scheduled_at:
        timeType === 'later'
        ? new Date(
            formData.get(
              'scheduledAt'
            )
          ).toISOString()
        : null,

      passengers:
        Number(
          formData.get(
            'passengers'
          )
        ),

      notes:
        formData
          .get('notes')
          .trim()
          || null,

      status:
        'new'

    };


    /* =====================
       SUMMARY
    ====================== */

    const summaryRows = [

      [
        'الاسم',
        pending.customer_name
      ],

      [
        'الانطلاق',
        pending.pickup
      ],

      [
        'منطقة الانطلاق',
        pending.pickup_zone
      ],

      [
        'الوجهة',
        pending.destination
      ],

      [
        'الوقت',
        pending.request_type ===
        'now'
        ? 'الآن'
        : localDate(
            pending.scheduled_at
          )
      ],

      [
        'الهاتف',
        pending.phone
      ],

      [
        'الركاب',
        pending.passengers
      ],

      [
        'الملاحظات',
        pending.notes || '—'
      ]

    ];


    summary.innerHTML =
      summaryRows
        .map(
          ([label,value]) => `

            <div class="summary-row">

              <span>
                ${escapeHtml(label)}
              </span>

              <strong>
                ${escapeHtml(value)}
              </strong>

            </div>

          `
        )
        .join('');


    confirmDialog.showModal();

  }
);


/* =========================
   EDIT REQUEST
========================= */

document
  .getElementById(
    'cancelConfirm'
  )
  .onclick =
  () => {

    confirmDialog.close();

  };


/* =========================
   CONFIRM REQUEST
========================= */

document
  .getElementById(
    'confirmRequest'
  )
  .onclick =
  async () => {

    const button =
      document.getElementById(
        'confirmRequest'
      );


    button.disabled =
      true;


    button.textContent =
      'جارٍ إرسال الطلب...';


    try{

      /*
       عند إدخال الطلب:
       Trigger في Supabase يبدأ
       Auto Dispatch مباشرة.
      */

      const {
        error
      } =
      await supabaseClient
        .from(
          'ride_requests'
        )
        .insert(
          pending
        );


      if(error){

        throw error;

      }


      confirmDialog.close();


      document
        .getElementById(
          'orderNumber'
        )
        .textContent =
        pending.order_number;


      /*
       تجهيز رابط تتبع الطلب
      */

      const trackLink =
        document.getElementById(
          'trackRequestLink'
        );


      if(trackLink){

        trackLink.href =
          'track.html' +
          '?order=' +
          encodeURIComponent(
            pending.order_number
          ) +
          '&phone=' +
          encodeURIComponent(
            pending.phone
          );

      }


      successDialog.showModal();


      form.reset();


      laterWrap
        .classList
        .add(
          'hidden'
        );


    }catch(error){

      console.error(
        error
      );


      alert(
        error.message ||
        'تعذر إرسال الطلب. حاول مرة أخرى.'
      );


    }finally{

      button.disabled =
        false;


      button.textContent =
        'تأكيد الطلب';

    }

  };


/* =========================
   NEW REQUEST
========================= */

document
  .getElementById(
    'newRequest'
  )
  .onclick =
  () => {

    successDialog.close();

  };
