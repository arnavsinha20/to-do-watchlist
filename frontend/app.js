const endpoints = {
  login: '/api/auth/login',
  register: '/api/auth/register',
  tasks: (userId) => `/api/users/${userId}/tasks`,
};

const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const toast = document.getElementById('toast');
const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutButton = document.getElementById('logoutButton');
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const welcomeLabel = document.getElementById('welcomeLabel');
const appTitle = document.getElementById('appTitle');

const state = {
  authMode: 'login',
  user: loadStoredUser(),
  tasks: [],
};

function loadStoredUser() {
  try {
    const raw = localStorage.getItem('taskUser');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function storeUser(user) {
  state.user = user;
  localStorage.setItem('taskUser', JSON.stringify(user));
}

function clearUser() {
  state.user = null;
  state.tasks = [];
  localStorage.removeItem('taskUser');
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.style.background = isError ? '#b42318' : '#0f172a';
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2600);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.message || 'Request failed');
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function switchAuthMode(mode) {
  state.authMode = mode;
  authTabs.forEach((tab) => {
    const isActive = tab.dataset.mode === mode;
    tab.classList.toggle('active', isActive);
  });
  const isLogin = mode === 'login';
  loginForm.classList.toggle('hidden', !isLogin);
  registerForm.classList.toggle('hidden', isLogin);
}

function renderAppState() {
  const loggedIn = Boolean(state.user);
  authSection.hidden = loggedIn;
  appSection.hidden = !loggedIn;

  if (loggedIn) {
    welcomeLabel.textContent = `Hello, ${state.user.name}`;
    appTitle.textContent = 'Your tasks';
  }
}

function renderTasks() {
  taskList.innerHTML = '';
  const template = document.getElementById('taskTemplate');

  if (state.tasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'task-row';
    empty.textContent = 'No tasks yet. Add your first one above.';
    taskList.appendChild(empty);
    return;
  }

  state.tasks.forEach((task) => {
    const clone = template.content.cloneNode(true);
    const checkbox = clone.querySelector('input[type="checkbox"]');
    const title = clone.querySelector('.task-title');
    const editButton = clone.querySelector('.action.edit');
    const deleteButton = clone.querySelector('.action.danger');

    checkbox.checked = task.completed;
    title.textContent = task.title;
    title.classList.toggle('completed', task.completed);

    checkbox.addEventListener('change', () => toggleTask(task.id, checkbox.checked));
    editButton.addEventListener('click', () => editTaskPrompt(task));
    deleteButton.addEventListener('click', () => removeTask(task.id));

    taskList.appendChild(clone);
  });
}

async function fetchTasks() {
  if (!state.user) {
    return;
  }
  try {
    const data = await request(endpoints.tasks(state.user.id));
    state.tasks = data;
    renderTasks();
  } catch (error) {
    showToast(error.message, true);
    if (error.status === 401 || error.status === 404) {
      clearUser();
      renderAppState();
    }
  }
}

async function createTask(title) {
  if (!state.user) {
    return;
  }
  await request(endpoints.tasks(state.user.id), {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  await fetchTasks();
  showToast('Task added');
}

async function toggleTask(taskId, completed) {
  if (!state.user) {
    return;
  }
  try {
    await request(`${endpoints.tasks(state.user.id)}/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ completed }),
    });
    await fetchTasks();
  } catch (error) {
    showToast(error.message, true);
  }
}

function editTaskPrompt(task) {
  const nextTitle = window.prompt('Update task title', task.title);
  if (nextTitle === null) {
    return;
  }
  const trimmed = nextTitle.trim();
  if (!trimmed) {
    showToast('Title cannot be empty', true);
    return;
  }
  updateTask(task.id, { title: trimmed });
}

async function updateTask(taskId, payload) {
  if (!state.user) {
    return;
  }
  try {
    await request(`${endpoints.tasks(state.user.id)}/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await fetchTasks();
    showToast('Task updated');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function removeTask(taskId) {
  if (!state.user) {
    return;
  }
  const confirmed = window.confirm('Delete this task? This cannot be undone.');
  if (!confirmed) {
    return;
  }
  try {
    await request(`${endpoints.tasks(state.user.id)}/${taskId}`, { method: 'DELETE' });
    await fetchTasks();
    showToast('Task removed');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const mode = form.dataset.mode;

  try {
    if (mode === 'login') {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const { user } = await request(endpoints.login, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      storeUser(user);
      showToast('Logged in');
    } else {
      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const { user } = await request(endpoints.register, {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      storeUser(user);
      registerForm.reset();
      showToast('Account created');
    }

    loginForm.reset();
    renderAppState();
    await fetchTasks();
  } catch (error) {
    showToast(error.message, true);
  }
}

authTabs.forEach((tab) =>
  tab.addEventListener('click', () => {
    switchAuthMode(tab.dataset.mode);
  })
);

loginForm.addEventListener('submit', handleAuthSubmit);
registerForm.addEventListener('submit', handleAuthSubmit);

logoutButton.addEventListener('click', () => {
  clearUser();
  renderAppState();
  switchAuthMode('login');
  showToast('Logged out');
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) {
    showToast('Add a task title first', true);
    return;
  }
  try {
    await createTask(title);
    taskInput.value = '';
  } catch (error) {
    showToast(error.message, true);
  }
});

switchAuthMode(state.authMode);
renderAppState();
if (state.user) {
  fetchTasks();
}
