const form = document.querySelector('[data-login-form]');
const message = document.querySelector('[data-login-message]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(form);
  const button = form.querySelector('button');
  button.disabled = true;
  message.hidden = true;
  try {
    const response = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', username: values.get('username'), password: values.get('password') }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível fazer login.');
    location.replace('/admin/');
  } catch (error) {
    message.textContent = error.message;
    message.hidden = false;
  } finally { button.disabled = false; }
});
