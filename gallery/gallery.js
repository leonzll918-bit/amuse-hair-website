const galleryPhotos = Array.from(document.querySelectorAll('[data-gallery-photo]'));
const galleryLightbox = document.querySelector('.gallery-lightbox');

if (galleryPhotos.length && galleryLightbox) {
  const lightboxImage = galleryLightbox.querySelector('.gallery-lightbox-image');
  const closeButton = galleryLightbox.querySelector('.gallery-lightbox-close');
  const previousButton = galleryLightbox.querySelector('.gallery-lightbox-previous');
  const nextButton = galleryLightbox.querySelector('.gallery-lightbox-next');
  const count = galleryLightbox.querySelector('.gallery-lightbox-count');
  let activeIndex = 0;
  let openingPhoto = null;
  let touchStart = null;

  const showPhoto = (index) => {
    activeIndex = (index + galleryPhotos.length) % galleryPhotos.length;
    const photo = galleryPhotos[activeIndex];
    const thumbnail = photo.querySelector('img');

    lightboxImage.src = photo.dataset.full;
    lightboxImage.alt = thumbnail.alt;
    count.textContent = `Photo ${activeIndex + 1} of ${galleryPhotos.length}`;
  };

  const openPhoto = (photo) => {
    openingPhoto = photo;
    showPhoto(galleryPhotos.indexOf(photo));
    galleryLightbox.showModal();
    closeButton.focus();
  };

  const closeLightbox = () => {
    if (galleryLightbox.open) galleryLightbox.close();
  };

  galleryPhotos.forEach((photo) => {
    photo.addEventListener('click', () => openPhoto(photo));
  });

  closeButton.addEventListener('click', closeLightbox);
  previousButton.addEventListener('click', () => showPhoto(activeIndex - 1));
  nextButton.addEventListener('click', () => showPhoto(activeIndex + 1));

  galleryLightbox.addEventListener('click', (event) => {
    if (event.target === galleryLightbox) closeLightbox();
  });

  galleryLightbox.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPhoto(activeIndex - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showPhoto(activeIndex + 1);
    }
  });

  galleryLightbox.addEventListener('close', () => {
    if (openingPhoto?.isConnected) openingPhoto.focus();
    openingPhoto = null;
  });

  lightboxImage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') touchStart = { x: event.clientX, y: event.clientY };
  });

  document.addEventListener('pointerup', (event) => {
    if (!touchStart) return;
    const deltaX = event.clientX - touchStart.x;
    const deltaY = event.clientY - touchStart.y;
    if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
      showPhoto(activeIndex + (deltaX < 0 ? 1 : -1));
    }
    touchStart = null;
  });

  document.addEventListener('pointercancel', () => {
    touchStart = null;
  });
}
