(() => {
  const REVIEW_API_URL = 'https://amuse-review-api.abbylim1116.workers.dev';
  const state = { services: [], rating: 0, tags: [], language: 'en' };
  const serviceCategories = [...document.querySelectorAll('.service-category')];
  const serviceParents = [...document.querySelectorAll('.service-parent')];
  const serviceChildren = [...document.querySelectorAll('.service-child')];
  const serviceExpanders = [...document.querySelectorAll('.service-expand')];
  const starButtons = [...document.querySelectorAll('[data-group="rating"] .star')];
  const tagButtons = [...document.querySelectorAll('[data-group="tags"] .tag')];
  const languageButtons = [...document.querySelectorAll('.language-button')];
  const draftPanel = document.getElementById('draft-panel');
  const draftTitle = document.getElementById('draft-title');
  const draft = document.getElementById('review-draft');
  const copyButton = document.getElementById('copy-review');
  const copyStatus = document.getElementById('copy-status');
  const generationStatus = document.getElementById('generation-status');
  const googleLink = document.getElementById('open-google');
  const privateFeedback = document.getElementById('private-feedback');

  const track = (eventName, params = {}) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        page_path: window.location.pathname,
        ...params,
      });
    }
  };

  const syncServicesFromUI = () => {
    const selected = [
      ...serviceParents.filter((button) => button.classList.contains('is-selected')),
      ...serviceChildren.filter((button) => button.classList.contains('is-selected')),
    ];
    state.services = selected.map((button) => button.dataset.value);
  };

  serviceExpanders.forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.closest('.service-category');
      const children = category.querySelector('.service-children');
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      children.hidden = expanded;
    });
  });

  serviceParents.forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.closest('.service-category');
      const children = [...category.querySelectorAll('.service-child')];
      const willSelect = !button.classList.contains('is-selected');

      button.classList.toggle('is-selected', willSelect);
      if (willSelect) {
        children.forEach((child) => child.classList.remove('is-selected'));
      }
      syncServicesFromUI();
    });
  });

  serviceChildren.forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.closest('.service-category');
      const parent = category.querySelector('.service-parent');
      const willSelect = !button.classList.contains('is-selected');

      button.classList.toggle('is-selected', willSelect);
      if (willSelect) {
        parent.classList.remove('is-selected');
      }
      syncServicesFromUI();
    });
  });

  starButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.rating = Number(button.dataset.value);
      starButtons.forEach((item) => {
        item.classList.toggle('is-selected', Number(item.dataset.value) <= state.rating);
      });
    });
  });

  tagButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.value;
      const selected = state.tags.includes(value);
      state.tags = selected ? state.tags.filter((tag) => tag !== value) : [...state.tags, value];
      button.classList.toggle('is-selected', !selected);
    });
  });

  async function generateDraft(language) {
    if (!state.services.length || !state.rating) {
      generationStatus.textContent = 'Please choose at least one service and a rating first.';
      return;
    }

    state.language = language;
    generationStatus.textContent = language === 'zh' ? '正在生成评论…' : 'Generating your review…';
    languageButtons.forEach((button) => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    });

    try {
      const response = await fetch(REVIEW_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: state.services,
          rating: state.rating,
          tags: state.tags,
          language,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.review) {
        throw new Error(data.error || 'Unable to generate review');
      }

      draft.value = data.review;
      draftPanel.hidden = false;
      draftTitle.textContent = language === 'zh' ? '你的评论草稿' : 'Your review draft';
      copyButton.textContent = language === 'zh' ? '复制评论' : 'Copy review';
      googleLink.textContent = language === 'zh' ? '打开 Google 评论' : 'Open Google Review';
      privateFeedback.textContent = language === 'zh' ? '通过 WhatsApp 私下告诉我们更多' : 'Tell us more privately on WhatsApp';
      privateFeedback.hidden = state.rating > 3;
      copyStatus.textContent = '';
      generationStatus.textContent = '';
      draftPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

      track('review_generate', {
        services: state.services.join(' | '),
        service_count: state.services.length,
        rating: state.rating,
        tag_count: state.tags.length,
        language,
        generator: 'deepseek',
      });
    } catch (error) {
      console.error(error);
      generationStatus.textContent = language === 'zh'
        ? '暂时无法生成评论，请稍后再试。'
        : 'We could not generate your review right now. Please try again.';
    } finally {
      languageButtons.forEach((button) => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      });
    }
  }

  languageButtons.forEach((button) => {
    button.addEventListener('click', () => generateDraft(button.dataset.language));
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(draft.value.trim());
      copyStatus.textContent = state.language === 'zh'
        ? '已复制。你可以粘贴到 Google 评论，并在发布前自行修改。'
        : 'Copied. You can paste it into Google Review and edit anything you like.';
      track('review_copy', {
        services: state.services.join(' | '),
        service_count: state.services.length,
        rating: state.rating,
        language: state.language,
      });
    } catch (_) {
      draft.focus();
      draft.select();
      copyStatus.textContent = state.language === 'zh'
        ? '请手动复制上方文字，然后粘贴到 Google 评论。'
        : 'Select and copy the text above, then paste it into Google Review.';
    }
  });

  googleLink.addEventListener('click', () => {
    track('review_google_open', {
      services: state.services.join(' | '),
      service_count: state.services.length,
      rating: state.rating,
      language: state.language,
    });
  });

  privateFeedback.addEventListener('click', () => {
    track('review_private_feedback', {
      services: state.services.join(' | '),
      service_count: state.services.length,
      rating: state.rating,
      language: state.language,
    });
  });
})();
