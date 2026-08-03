const $ = (selector, scope = document) => scope.querySelector(selector);
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
let gifts = [];
let selectedGiftId = '';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function selectedGift() { return gifts.find((gift) => gift.id === selectedGiftId) || null; }

function hasSlots(gift) { return Number(gift.reservation_count) < Number(gift.reservation_limit); }

function renderGifts() {
  const grid = $('[data-gift-grid]');
  $('[data-gift-count]').textContent = String(gifts.length);
  grid.innerHTML = gifts.map((gift) => {
    const available = hasSlots(gift);
    const remaining = Math.max(0, Number(gift.reservation_limit) - Number(gift.reservation_count));
    const image = gift.image_url ? `<img src="${escapeHtml(gift.image_url)}" alt="">` : `<span>${escapeHtml(gift.icon || '✦')}</span>`;
    return `<article class="gift-card${available ? '' : ' gift-card-reserved'} reveal visible"><div class="gift-art${gift.image_url ? ' has-image' : ''}" aria-hidden="true">${image}</div><div class="gift-info"><h3>${escapeHtml(gift.name)}</h3><p class="gift-price">${money.format(Number(gift.price))}</p>${available ? `<p class="gift-availability">${remaining} ${remaining === 1 ? 'escolha disponível' : 'escolhas disponíveis'}</p><button class="outline-button gift-choice" type="button" data-select-gift="${escapeHtml(gift.id)}">Escolher presente</button>` : '<span class="gift-status">Indisponível</span>'}</div></article>`;
  }).join('');
}

function renderSelectedGift() {
  const panel = $('[data-selected-gift]');
  const input = $('[name="gift_id"]');
  const gift = selectedGift();
  input.value = gift ? gift.id : '';
  panel.hidden = !gift;
  panel.innerHTML = gift ? `<small>Presente escolhido</small><strong>${escapeHtml(gift.name)}</strong><p>Ele será reservado ao enviar este formulário.</p><button class="selected-gift-clear" type="button" data-clear-gift>Trocar</button>` : '';
}

function setMessage(message, error = false) {
  const node = $('[data-rsvp-message]');
  node.hidden = !message;
  node.textContent = message || '';
  node.className = `notice field-full ${error ? 'error' : 'success'}`;
}

async function loadGifts() {
  const response = await fetch('/api/public', { headers: { Accept: 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a lista de presentes.');
  gifts = data.gifts;
  const selected = selectedGift();
  if (selectedGiftId && (!selected || !hasSlots(selected))) selectedGiftId = '';
  renderGifts();
  renderSelectedGift();
}

function updateCountdown() {
  const root = $('[data-wedding-date]');
  const distance = Math.max(0, new Date(root.dataset.weddingDate).getTime() - Date.now());
  const values = { days: Math.floor(distance / 86400000), hours: Math.floor((distance % 86400000) / 3600000), minutes: Math.floor((distance % 3600000) / 60000), seconds: Math.floor((distance % 60000) / 1000) };
  Object.entries(values).forEach(([name, value]) => { $(`[data-countdown="${name}"]`).textContent = String(value).padStart(2, '0'); });
}

function initInterface() {
  const menuButton = $('[data-menu-toggle]');
  const menu = $('[data-site-nav]');
  menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; menuButton.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open); });
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      menuButton.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
    }
  });
  document.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-select-gift]');
    if (choice) {
      selectedGiftId = choice.dataset.selectGift;
      renderSelectedGift();
      $('#rsvp').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (event.target.closest('[data-clear-gift]')) { selectedGiftId = ''; renderSelectedGift(); }
  });
  $$('[data-copy-address]').forEach((button) => button.addEventListener('click', async () => { const original = button.textContent; try { await navigator.clipboard.writeText(button.dataset.copyAddress); button.textContent = 'Endereço copiado'; } catch { button.textContent = button.dataset.copyAddress; } setTimeout(() => { button.textContent = original; }, 2500); }));
  const topbar = $('[data-topbar]');
  addEventListener('scroll', () => topbar.classList.toggle('scrolled', scrollY > 4), { passive: true });
  if ('IntersectionObserver' in window) { const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: 0.12 }); document.querySelectorAll('.reveal').forEach((node) => observer.observe(node)); } else document.querySelectorAll('.reveal').forEach((node) => node.classList.add('visible'));
}

function $$ (selector, scope = document) { return [...scope.querySelectorAll(selector)]; }

function initRsvp() {
  const form = $('[data-rsvp-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const values = new FormData(form);
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    setMessage('');
    try {
      const attendance = values.get('attendance');
      const response = await fetch('/api/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rsvp', name: values.get('name'), phone: values.get('phone'), attendance, adults: values.get('adults'), children: values.get('children'), note: values.get('note'), consent: values.get('consent') === 'on', giftId: selectedGiftId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a confirmação.');
      form.reset(); selectedGiftId = ''; setMessage(data.message); await loadGifts();
    } catch (error) { setMessage(error.message, true); }
    finally { button.disabled = false; }
  });
}

initInterface();
initRsvp();
updateCountdown();
setInterval(updateCountdown, 1000);
loadGifts().catch((error) => setMessage(error.message, true));
