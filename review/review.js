(() => {
  const state = { service: '', rating: 0, tags: [] };
  const serviceButtons = [...document.querySelectorAll('[data-group="service"] .choice')];
  const starButtons = [...document.querySelectorAll('[data-group="rating"] .star')];
  const tagButtons = [...document.querySelectorAll('[data-group="tags"] .tag')];
  const generateButton = document.getElementById('generate-review');
  const draftPanel = document.getElementById('draft-panel');
  const draft = document.getElementById('review-draft');
  const copyButton = document.getElementById('copy-review');
  const copyStatus = document.getElementById('copy-status');
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

  serviceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      serviceButtons.forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
      state.service = button.dataset.value;
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

  const positiveMap = {
    'Loved the result': 'I was really happy with the result',
    'Friendly stylist': 'The stylist was friendly',
    'Good consultation': 'The consultation was clear and helpful',
    'Comfortable salon': 'The salon felt comfortable',
    'Good service': 'The service was good throughout my visit',
    'Would come again': 'I would be happy to come back again',
  };

  const negativeMap = {
    'Long waiting time': 'The waiting time was longer than I expected',
    'Result was not what I expected': 'The final result was not quite what I expected',
  };

  function joinNatural(parts) {
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1].replace(/^./, (c) => c.toLowerCase())}`;
    const normalized = parts.map((part, index) => index === 0 ? part : part.replace(/^./, (c) => c.toLowerCase()));
    return `${normalized.slice(0, -1).join(', ')}, and ${normalized.at(-1)}`;
  }

  function servicePhrase() {
    const phrases = {
      'Hair Colour': 'for hair colour',
      'Hair Treatment': 'for a hair treatment',
      'Haircut': 'for a haircut',
      'Perm': 'for a perm',
      'Other': 'during a recent visit',
    };
    return phrases[state.service] || 'during a recent visit';
  }

  function generateDraft() {
    if (!state.service || !state.rating) {
      copyStatus.textContent = 'Please choose your service and rating first.';
      return;
    }

    const positive = state.tags.filter((tag) => positiveMap[tag]).map((tag) => positiveMap[tag]);
    const negative = state.tags.filter((tag) => negativeMap[tag]).map((tag) => negativeMap[tag]);

    let intro;
    if (state.rating >= 4) {
      intro = `I visited Amuse Hair Studio ${servicePhrase()} and had a good experience.`;
    } else if (state.rating === 3) {
      intro = `I visited Amuse Hair Studio ${servicePhrase()}. My experience was mixed overall.`;
    } else {
      intro = `I visited Amuse Hair Studio ${servicePhrase()} and wanted to share my experience.`;
    }

    const sentences = [intro];
    if (positive.length) sentences.push(`${joinNatural(positive)}.`);
    if (negative.length) sentences.push(`${joinNatural(negative)}.`);
    if (!positive.length && !negative.length) {
      if (state.rating >= 4) {
        sentences.push('Overall, I was happy with my visit.');
      } else if (state.rating === 3) {
        sentences.push('There were things I liked and things that could have been better.');
      } else {
        sentences.push('My experience did not fully meet my expectations.');
      }
    }

    draft.value = sentences.join(' ');
    draftPanel.hidden = false;
    privateFeedback.hidden = state.rating > 3;
    copyStatus.textContent = '';
    draftPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    track('review_generate', {
      service: state.service,
      rating: state.rating,
      tag_count: state.tags.length,
    });
  }

  generateButton.addEventListener('click', generateDraft);

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(draft.value.trim());
      copyStatus.textContent = 'Copied. You can paste it into Google Review and edit anything you like.';
      track('review_copy', {
        service: state.service,
        rating: state.rating,
      });
    } catch (_) {
      draft.focus();
      draft.select();
      copyStatus.textContent = 'Select and copy the text above, then paste it into Google Review.';
    }
  });

  googleLink.addEventListener('click', () => {
    track('review_google_open', {
      service: state.service,
      rating: state.rating,
    });
  });

  privateFeedback.addEventListener('click', () => {
    track('review_private_feedback', {
      service: state.service,
      rating: state.rating,
    });
  });
})();
