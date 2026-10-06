(() => {
  const REVIEW_API_URL = 'https://amuse-review-api.abbylim1116.workers.dev';

  const SERVICE_CATEGORY_MAP = {
    'Hair Colour': 'colour',
    'Root Touch Up': 'colour',
    'Basic Color': 'colour',
    'Highlight': 'colour',
    'Balayage / Ombre': 'colour',
    'Hair Treatment': 'treatment',
    'Scalp Treatment': 'scalp',
    'Keratin Treatment': 'treatment',
    'Moisture Treatment': 'treatment',
    'Japanese Repair Treatment': 'treatment',
    'Essential 6-Step Scalp Treatment': 'scalp',
    'Haircut & Styling': 'cut',
    'Men’s Cut': 'cut',
    'Ladies’ Cut': 'cut',
    'Wash & Blow': 'styling',
    'Styling': 'styling',
    'Hair Chemical': 'chemical',
    'Rebonding / Relaxing': 'straightening',
    'Cold Perm': 'perm',
    'Digital Perm': 'perm',
    'Men': 'men',
    'Men’s Color': 'colour',
    'Men’s Bleach': 'colour',
    'Men’s Rebonding': 'straightening',
    'Men’s Perm': 'perm',
  };

  const SERVICE_TAGS = {
    colour: [
      'Colour turned out as expected',
      'Stylist helped me choose the colour',
      'Happy with the final shade',
      'Colour looks even',
      'Hair still feels good after colouring',
    ],
    treatment: [
      'Hair feels softer',
      'Hair feels smoother',
      'Less frizzy',
      'Hair feels healthier',
      'Treatment felt comfortable',
    ],
    scalp: [
      'Scalp feels cleaner',
      'Scalp feels refreshed',
      'Treatment felt comfortable',
    ],
    cut: [
      'Stylist understood what I wanted',
      'Happy with the shape',
      'Cut suits me',
      'Easy to manage',
    ],
    styling: [
      'Styling looks natural',
      'Happy with the shape',
      'Stylist understood what I wanted',
    ],
    perm: [
      'Curls look natural',
      'Happy with the curl shape',
      'Hair feels more manageable',
      'Stylist explained the process clearly',
    ],
    straightening: [
      'Hair looks smoother',
      'Hair feels more manageable',
      'Happy with the straightening result',
      'Stylist explained the process clearly',
    ],
    chemical: [
      'Stylist explained the process clearly',
      'Happy with the result',
      'Hair feels more manageable',
    ],
    men: [
      'Stylist understood what I wanted',
      'Happy with the result',
    ],
  };

  const state = {
    services: [],
    rating: 0,
    generalTags: [],
    serviceTags: [],
    language: 'en',
    stylist: null,
    generatedBaseline: null,
    generatedBaselineContext: null,
    editedReportedForCurrentGeneration: false,
  };

  const serviceParents = [...document.querySelectorAll('.service-parent')];
  const serviceChildren = [...document.querySelectorAll('.service-child')];
  const serviceExpanders = [...document.querySelectorAll('.service-expand')];
  const starButtons = [...document.querySelectorAll('[data-group="rating"] .star')];
  const generalTagButtons = [...document.querySelectorAll('[data-group="general-tags"] .tag')];
  const serviceTagPanel = document.getElementById('service-tag-panel');
  const serviceTagGrid = document.getElementById('service-specific-tags');
  const languageButtons = [...document.querySelectorAll('.language-button')];
  const stylistButtons = [...document.querySelectorAll('.stylist-choice')];
  const stylistLabel = document.getElementById('stylist-label');
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

  const currentReviewContext = () => state.generatedBaselineContext ?? {
    services: [...state.services],
    rating: state.rating,
    language: state.language,
  };

  const reviewActionParams = () => {
    const context = currentReviewContext();
    return {
      services: context.services.join(' | '),
      service_count: context.services.length,
      rating: context.rating,
      language: context.language,
    };
  };

  const reportMeaningfulEdit = () => {
    if (
      state.generatedBaseline === null ||
      state.editedReportedForCurrentGeneration ||
      draft.value.trim() === state.generatedBaseline.trim()
    ) {
      return;
    }

    track('review_edited', reviewActionParams());
    state.editedReportedForCurrentGeneration = true;
  };

  const renderServiceTags = () => {
    const categories = [...new Set(
      state.services
        .map((service) => SERVICE_CATEGORY_MAP[service])
        .filter(Boolean)
    )];

    const availableTags = [...new Set(
      categories.flatMap((category) => SERVICE_TAGS[category] || [])
    )];

    state.serviceTags = state.serviceTags.filter((tag) => availableTags.includes(tag));
    serviceTagGrid.innerHTML = '';

    if (!availableTags.length) {
      serviceTagPanel.hidden = true;
      return;
    }

    availableTags.forEach((tag) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice tag service-tag';
      button.dataset.value = tag;
      button.textContent = tag;
      button.classList.toggle('is-selected', state.serviceTags.includes(tag));
      button.addEventListener('click', () => {
        const selected = state.serviceTags.includes(tag);
        state.serviceTags = selected
          ? state.serviceTags.filter((item) => item !== tag)
          : [...state.serviceTags, tag];
        button.classList.toggle('is-selected', !selected);
      });
      serviceTagGrid.appendChild(button);
    });

    serviceTagPanel.hidden = false;
  };

  const syncServicesFromUI = () => {
    const selected = [
      ...serviceParents.filter((button) => button.classList.contains('is-selected')),
      ...serviceChildren.filter((button) => button.classList.contains('is-selected')),
    ];
    state.services = selected.map((button) => button.dataset.value);
    renderServiceTags();
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

  generalTagButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.value;
      const selected = state.generalTags.includes(value);
      state.generalTags = selected
        ? state.generalTags.filter((tag) => tag !== value)
        : [...state.generalTags, value];
      button.classList.toggle('is-selected', !selected);
    });
  });

  stylistButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.value;
      state.stylist = state.stylist === value ? null : value;
      stylistButtons.forEach((item) => {
        const selected = item.dataset.value === state.stylist;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    });
  });

  async function generateDraft(language) {
    if (!state.services.length || !state.rating) {
      generationStatus.textContent = 'Please choose at least one service and a rating first.';
      return;
    }

    state.language = language;
    stylistLabel.textContent = language === 'zh' ? '发型师（可选）' : 'Stylist (optional)';
    const tags = [...state.generalTags, ...state.serviceTags];
    const requestContext = Object.freeze({
      services: Object.freeze([...state.services]),
      rating: state.rating,
      language,
      generalTagCount: state.generalTags.length,
      serviceTagCount: state.serviceTags.length,
    });
    const requestStylist = state.stylist;
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
          services: requestContext.services,
          rating: requestContext.rating,
          experience_tags: tags,
          language: requestContext.language,
          ...(requestStylist ? { stylist: requestStylist } : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.review) {
        throw new Error(data.error || 'Unable to generate review');
      }

      const isRegeneration = state.generatedBaseline !== null;
      draft.value = data.review;
      state.generatedBaseline = data.review;
      state.generatedBaselineContext = requestContext;
      state.editedReportedForCurrentGeneration = false;
      draftPanel.hidden = false;
      draftTitle.textContent = language === 'zh' ? '你的评论草稿' : 'Your review draft';
      copyButton.textContent = language === 'zh' ? '复制评论' : 'Copy review';
      googleLink.textContent = language === 'zh' ? '打开 Google 评论' : 'Open Google Review';
      privateFeedback.textContent = language === 'zh' ? '通过 WhatsApp 私下告诉我们更多' : 'Tell us more privately on WhatsApp';
      privateFeedback.hidden = state.rating > 3;
      copyStatus.textContent = '';
      generationStatus.textContent = '';
      draftPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const generationParams = {
        services: requestContext.services.join(' | '),
        service_count: requestContext.services.length,
        rating: requestContext.rating,
        general_tag_count: requestContext.generalTagCount,
        service_tag_count: requestContext.serviceTagCount,
        language: requestContext.language,
        generator: 'deepseek',
      };
      track('review_generate', generationParams);
      if (isRegeneration) {
        track('review_regenerate', generationParams);
      }
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
      reportMeaningfulEdit();
      copyStatus.textContent = state.language === 'zh'
        ? '已复制。你可以粘贴到 Google 评论，并在发布前自行修改。'
        : 'Copied. You can paste it into Google Review and edit anything you like.';
      track('review_copy', {
        ...reviewActionParams(),
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
    reportMeaningfulEdit();
    track('review_google_open', reviewActionParams());
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
