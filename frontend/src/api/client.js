// Les URLs sont injectées au build/runtime via variables d'environnement Vite.
const BOOKS_API = import.meta.env.VITE_BOOKS_API_URL || "http://localhost:8001";
const USERS_API = import.meta.env.VITE_USERS_API_URL || "http://localhost:8002";
const LOANS_API = import.meta.env.VITE_LOANS_API_URL || "http://localhost:8003";

const TOKEN_KEY = "dit_library_token";

function authHeader() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// FastAPI renvoie `detail` sous plusieurs formes selon le type d'erreur :
// - une chaîne simple (ex. règles métier : "Un livre avec cet ISBN existe déjà")
// - un tableau d'objets de validation Pydantic sur les erreurs 422, ex :
//   [{"type":"string_too_short","loc":["body","isbn"],"msg":"String should have at least 5 characters", ...}]
// Sans ce traitement, `new Error(detail)` sur un tableau produit "[object Object]".
function extractErrorMessage(body, fallback) {
  const detail = body && body.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : item.loc;
        return field ? `${field} : ${item.msg}` : item.msg || JSON.stringify(item);
      })
      .join(" — ");
  }
  if (typeof detail === "object") return JSON.stringify(detail);
  return String(detail);
}

async function request(url, options = {}, { auth = true } = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(auth ? authHeader() : {}),
    },
    ...options,
  });

  if (res.status === 401 && auth) {
    // Session expirée ou absente : on nettoie et on force le retour à l'écran de connexion.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("dit_library_user");
    window.location.href = "/login";
    throw new Error("Session expirée, veuillez vous reconnecter");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = extractErrorMessage(body, detail);
    } catch (_) {
      /* pas de corps JSON */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---- Authentification (users-service) ----
export const authApi = {
  login: (email, password) =>
    request(`${USERS_API}/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) }, { auth: false }),
  register: (payload) =>
    request(`${USERS_API}/auth/register`, { method: "POST", body: JSON.stringify(payload) }, { auth: false }),
  me: () => request(`${USERS_API}/auth/me`),
};

// ---- Livres ----
export const booksApi = {
  list: (search = "") =>
    request(`${BOOKS_API}/books${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  create: (data) => request(`${BOOKS_API}/books`, { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`${BOOKS_API}/books/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`${BOOKS_API}/books/${id}`, { method: "DELETE" }),
};

// ---- Utilisateurs ----
export const usersApi = {
  list: () => request(`${USERS_API}/users`),
  create: (data) => request(`${USERS_API}/users`, { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`${USERS_API}/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`${USERS_API}/users/${id}`, { method: "DELETE" }),
};

// ---- Emprunts ----
export const loansApi = {
  borrow: (bookId, userId) =>
    request(`${LOANS_API}/loans`, { method: "POST", body: JSON.stringify({ book_id: bookId, user_id: userId }) }),
  return: (loanId) => request(`${LOANS_API}/loans/${loanId}/return`, { method: "POST" }),
  history: () => request(`${LOANS_API}/loans/history`),
};
