const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-nav');
const isChinesePage = document.documentElement.lang === 'zh-CN';

const allowedWhatsAppServices = new Set(['colour', 'treatment', 'haircut', 'perm', 'general']);
const getWhatsAppService = (link) => {
  const explicitService = link.dataset.service?.trim().toLowerCase();
  return allowedWhatsAppServices.has(explicitService) ? explicitService : 'general';
};

const getWhatsAppCtaLocation = (link) => {
  const explicitLocation = link.dataset.ctaLocation?.trim();
  if (explicitLocation) return explicitLocation;
  if (link.matches('[data-cta-location="floating_whatsapp"], .floating-whatsapp, .whatsapp-float')) return 'floating_whatsapp';
  if (link.closest('.service-dialog, .services-page')) return 'service_page';
  if (link.closest('.site-header')) return 'header';
  if (link.closest('.hero')) return 'hero';
  if (link.closest('.site-footer, footer')) return 'footer';
  if (link.closest('.contact-page, .contact-primary, .visit, .visit-whatsapp')) return 'contact';
  if (link.closest('.about-page')) return 'about';
  return 'general';
};

const isWhatsAppUrl = (href) => /^(?:https?:)?\/\/(?:wa\.me|(?:api\.)?whatsapp\.com)(?:\/|$)/i.test(href)
  || /^whatsapp:\/\//i.test(href);

if (!window.__amuseWhatsAppTrackingBound) {
  window.__amuseWhatsAppTrackingBound = true;
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const link = target?.closest('a[href]');
    if (!link || !isWhatsAppUrl(link.href)) return;

    const service = getWhatsAppService(link);
    const ctaLocation = getWhatsAppCtaLocation(link);
    const gtagType = typeof window.gtag;
    const eventParams = {
      page_location: window.location.href,
      page_path: window.location.pathname,
      link_url: link.href,
      cta_location: ctaLocation,
      service
    };

    if (gtagType === 'function') window.gtag('event', 'whatsapp_click', eventParams);
  }, true);
}

const setNavigationLabel = (isOpen) => {
  const englishLabel = isOpen ? 'Close navigation' : 'Open navigation';
  const chineseLabel = isOpen ? '关闭导航' : '打开导航';
  menuButton.setAttribute('aria-label', isChinesePage ? chineseLabel : englishLabel);
};

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  setNavigationLabel(!isOpen);
  navigation.classList.toggle('is-open', !isOpen);
});

navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menuButton.setAttribute('aria-expanded', 'false');
    setNavigationLabel(false);
    navigation.classList.remove('is-open');
  }
});

const serviceDialog = document.querySelector('.service-dialog');

if (serviceDialog) {
  const serviceDialogLayout = serviceDialog.querySelector('.service-dialog-layout');
  const serviceDialogMedia = serviceDialog.querySelector('.service-dialog-media');
  const serviceDialogImage = serviceDialogMedia.querySelector('img');
  const serviceDialogKicker = serviceDialog.querySelector('.service-dialog-kicker');
  const serviceDialogTitle = serviceDialog.querySelector('#service-dialog-title');
  const serviceDialogDescription = serviceDialog.querySelector('.service-dialog-description');
  const serviceDialogMeta = serviceDialog.querySelector('.service-dialog-meta');
  const serviceDialogClose = serviceDialog.querySelector('.service-dialog-close');
  const serviceDialogCta = serviceDialog.querySelector('.service-dialog-cta');
  let serviceDialogTrigger = null;
  let previousBodyOverflow = '';

  const closeServiceDialog = () => {
    if (serviceDialog.open) serviceDialog.close();
  };

  document.querySelectorAll('.service-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const category = trigger.closest('.services-category');
      const categoryNumber = category.querySelector('.services-category-number').textContent.trim();
      const categoryName = category.querySelector('.services-category-heading h2').textContent.trim();
      const image = category.querySelector('.services-category-image:not([data-modal-image="false"]) img');
      const serviceName = trigger.textContent.trim();

      serviceDialogTrigger = trigger;
      serviceDialogTitle.textContent = serviceName;
      serviceDialogKicker.textContent = `${categoryNumber} / ${categoryName}`;
      serviceDialogDescription.textContent = trigger.dataset.description;
      serviceDialogMeta.textContent = trigger.dataset.meta;
      serviceDialogCta.dataset.service = allowedWhatsAppServices.has(trigger.dataset.service) ? trigger.dataset.service : 'general';
      const serviceMessage = isChinesePage
        ? `你好 Amuse Hair Studio，我想咨询${serviceName}服务。`
        : `Hi Amuse Hair Studio, I’d like to ask about ${serviceName}`;
      serviceDialogCta.href = `https://wa.me/60166163818?text=${encodeURIComponent(serviceMessage)}`;

      if (image) {
        serviceDialogImage.src = image.currentSrc || image.src;
        serviceDialogImage.alt = image.alt;
        serviceDialogMedia.hidden = false;
        serviceDialogLayout.classList.add('has-image');
      } else {
        serviceDialogImage.removeAttribute('src');
        serviceDialogImage.alt = '';
        serviceDialogMedia.hidden = true;
        serviceDialogLayout.classList.remove('has-image');
      }

      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      serviceDialog.showModal();
      serviceDialogClose.focus();
    });
  });

  serviceDialogClose.addEventListener('click', closeServiceDialog);

  serviceDialog.addEventListener('click', (event) => {
    if (event.target === serviceDialog) closeServiceDialog();
  });

  serviceDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeServiceDialog();
  });

  serviceDialog.addEventListener('close', () => {
    document.body.style.overflow = previousBodyOverflow;
    if (serviceDialogTrigger?.isConnected) serviceDialogTrigger.focus();
    serviceDialogTrigger = null;
  });
}
