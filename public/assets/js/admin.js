const $ = (selector, scope = document) => scope.querySelector(selector);
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
let state = { gifts: [], confirmations: [], stats: {} };

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function formatDate(value) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }
function setMessage(message = '', error = false) { const node = $('[data-admin-message]'); node.hidden = !message; node.textContent = message; node.className = `admin-notice ${error ? 'error' : 'success'}`; }

async function api(payload, options = {}) {
  const response = await fetch('/api/admin', { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, body: payload ? JSON.stringify(payload) : undefined });
  const data = await response.json();
  if (response.status === 401) { location.replace('/admin/login.html'); throw new Error('Sessão encerrada.'); }
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a ação.');
  return data;
}

function imagePreview(url = '') { const preview = $('[data-image-preview]'); preview.hidden = !url; $('img', preview).src = url; }

function render() {
  Object.entries(state.stats).forEach(([key, value]) => { const node = $(`[data-stat="${key}"]`); if (node) node.textContent = value; });
  $('[data-gifts-table]').innerHTML = state.gifts.map((gift) => {
    const names = state.confirmations.filter((item) => item.gift_id === gift.id).map((item) => item.name).join(', ');
    const full = Number(gift.reservation_count) >= Number(gift.reservation_limit);
    const picture = gift.image_url ? `<img class="gift-thumb" src="${escapeHtml(gift.image_url)}" alt="Foto de ${escapeHtml(gift.name)}">` : `<span class="gift-thumb-placeholder" aria-label="Sem foto">${escapeHtml(gift.icon || '✦')}</span>`;
    return `<tr><td>${picture}</td><td><strong>${escapeHtml(gift.name)}</strong>${names ? `<small>por ${escapeHtml(names)}</small>` : ''}</td><td>${money.format(Number(gift.price))}</td><td><span class="status ${full ? 'reserved' : 'available'}">${gift.reservation_count} de ${gift.reservation_limit} escolhido(s)${full ? ' · indisponível' : ''}</span></td><td class="actions"><button type="button" class="button-link" data-action="edit" data-id="${escapeHtml(gift.id)}">Editar</button><button type="button" class="button-link" data-action="release" data-id="${escapeHtml(gift.id)}" ${gift.reservation_count > 0 ? '' : 'disabled'}>Liberar</button><button type="button" class="button-link danger" data-action="delete-gift" data-id="${escapeHtml(gift.id)}">Remover</button></td></tr>`;
  }).join('');
  $('[data-confirmations-table]').innerHTML = state.confirmations.length ? state.confirmations.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${item.email ? `${escapeHtml(item.email)}<br>` : ''}${escapeHtml(item.phone)}${item.note ? `<br>Obs.: ${escapeHtml(item.note)}` : ''}</small></td><td>${item.attendance === 'sim' ? 'Confirmou' : 'Não irá'}</td><td>${item.adults} adulto(s)<br>${item.children} criança(s)</td><td>${escapeHtml(item.gift_name || '—')}</td><td>${formatDate(item.created_at)}</td><td><button type="button" class="button-link danger" data-action="delete-confirmation" data-id="${escapeHtml(item.id)}">Remover</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">Nenhuma confirmação recebida ainda.</td></tr>';
}

async function load() { state = await api(null, { method: 'GET' }); render(); }

function resetForm() {
  const form = $('[data-gift-form]'); form.reset(); $('[name="id"]', form).value = ''; $('[name="image_url"]', form).value = ''; $('[name="image_pathname"]', form).value = ''; $('[data-gift-form-title]').textContent = 'Adicionar presente'; $('[data-cancel-edit]').hidden = true; imagePreview();
}

function editGift(id) {
  const gift = state.gifts.find((item) => item.id === id); if (!gift) return;
  const form = $('[data-gift-form]');
  $('[name="id"]', form).value = gift.id; $('[name="name"]', form).value = gift.name; $('[name="price"]', form).value = Number(gift.price).toFixed(2).replace('.', ','); $('[name="reservation_limit"]', form).value = gift.reservation_limit; $('[name="icon"]', form).value = gift.icon || '✦'; $('[name="image_url"]', form).value = gift.image_url || ''; $('[name="image_pathname"]', form).value = gift.image_pathname || ''; $('[name="remove_image"]', form).checked = false; $('[data-gift-form-title]').textContent = 'Editar presente'; $('[data-cancel-edit]').hidden = false; imagePreview(gift.image_url || '');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function uploadImage(file) {
  const body = new FormData(); body.append('image', file);
  const response = await fetch('/api/upload', { method: 'POST', body }); const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a foto.');
  return data;
}

$('[data-gift-form]').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const button = $('button[type="submit"]', form); button.disabled = true; setMessage('');
  try {
    let imageUrl = values.get('image_url'); let imagePathname = values.get('image_pathname'); const image = values.get('image');
    if (image && image.size) { const uploaded = await uploadImage(image); imageUrl = uploaded.url; imagePathname = uploaded.pathname; } else if (values.get('remove_image') === 'on') { imageUrl = ''; imagePathname = ''; }
    await api({ action: 'saveGift', id: values.get('id'), name: values.get('name'), price: String(values.get('price')).replace(',', '.'), reservationLimit: values.get('reservation_limit'), icon: values.get('icon'), imageUrl, imagePathname }, { method: 'POST' });
    resetForm(); await load(); setMessage('Presente salvo com sucesso.');
  } catch (error) { setMessage(error.message, true); } finally { button.disabled = false; }
});

$('[data-gifts-table]').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]'); if (!button) return; const { action, id } = button.dataset;
  if (action === 'edit') return editGift(id);
  const text = action === 'release' ? 'Liberar todas as escolhas deste presente?' : 'Remover este presente da lista?'; if (!confirm(text)) return;
  try { await api({ action: action === 'release' ? 'releaseGift' : 'deleteGift', id }, { method: 'POST' }); await load(); setMessage(action === 'release' ? 'Presente liberado.' : 'Presente removido.'); } catch (error) { setMessage(error.message, true); }
});

$('[data-confirmations-table]').addEventListener('click', async (event) => { const button = event.target.closest('[data-action="delete-confirmation"]'); if (!button || !confirm('Remover esta confirmação?')) return; try { await api({ action: 'deleteConfirmation', id: button.dataset.id }, { method: 'POST' }); await load(); setMessage('Confirmação removida.'); } catch (error) { setMessage(error.message, true); } });
$('[data-cancel-edit]').addEventListener('click', resetForm);
$('#gift-image').addEventListener('change', (event) => { const file = event.target.files[0]; if (file) imagePreview(URL.createObjectURL(file)); });
$('[data-logout]').addEventListener('click', async () => { await api({ action: 'logout' }, { method: 'POST' }); location.replace('/admin/login.html'); });
load().catch((error) => setMessage(error.message, true));
