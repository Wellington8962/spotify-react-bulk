import { useEffect, useMemo, useState } from "react";
import "./App.css";
import axios from "axios";

/**
 * Spotify Web API (SPA) — Authorization Code Flow with PKCE
 * Redirect URI: http://127.0.0.1:3000/
 * Acesse o app por: http://127.0.0.1:3000/
 */

const CLIENT_ID = "e763782ecad64301ac57eb44e3620060";
const REDIRECT_URI = "http://127.0.0.1:3000/";
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

// Para buscar músicas (/search) não precisa de scopes especiais.
// Se futuramente precisar, adicione aqui, ex: "user-read-private"
const SCOPES = []; // ["user-read-email"]

// ---------- PKCE helpers ----------
function randomString(length = 64) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = window.crypto.getRandomValues(new Uint8Array(length));
  let res = "";
  for (let i = 0; i < length; i++) res += charset[values[i] % charset.length];
  return res;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await window.crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function buildLoginUrl() {
  const codeVerifier = randomString(64);
  window.localStorage.setItem("code_verifier", codeVerifier);

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(hashed);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  if (SCOPES.length) params.set("scope", SCOPES.join(" "));

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const codeVerifier = window.localStorage.getItem("code_verifier");
  if (!codeVerifier) throw new Error("code_verifier ausente no localStorage");

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Falha ao trocar code por token: ${res.status} - ${JSON.stringify(data)}`
    );
  }

  return data; // { access_token, token_type, scope, expires_in, refresh_token? }
}

function App() {
  const [token, setToken] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [searchedTracks, setSearchedTracks] = useState([]);
  const [authError, setAuthError] = useState("");

  const loginHandler = async (e) => {
    e.preventDefault();
    setAuthError("");
    const url = await buildLoginUrl();
    window.location.assign(url);
  };

  useEffect(() => {
    // 1) Se já tem token salvo, usa
    const storedToken = window.localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      return;
    }

    // 2) Se voltou do Spotify com ?code=
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      setAuthError(error);
      return;
    }

    if (!code) return;

    (async () => {
      try {
        const data = await exchangeCodeForToken(code);

        if (data.access_token) {
          window.localStorage.setItem("token", data.access_token);
          setToken(data.access_token);

          // limpa o ?code da URL (pra ficar bonitinho)
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, document.title, url.toString());
        } else {
          setAuthError("Não veio access_token na resposta do Spotify.");
          console.error("Resposta do token endpoint:", data);
        }
      } catch (err) {
        console.error(err);
        setAuthError(err.message || "Erro desconhecido na autenticação.");
      }
    })();
  }, []);

  const logout = () => {
    setToken("");
    setSearchedTracks([]);
    setSearchKey("");
    setAuthError("");
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("code_verifier");
  };

  const searchTracks = async (e) => {
    e.preventDefault();
    if (!searchKey.trim()) return;

    try {
      const { data } = await axios.get("https://api.spotify.com/v1/search", {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: searchKey, type: "track", limit: 10 },
      });

      setSearchedTracks(data?.tracks?.items ?? []);
    } catch (error) {
      console.error("Erro ao buscar faixas:", error);
    }
  };

  const tracksView = useMemo(() => {
    return searchedTracks.map((track) => (
      <div key={track.id} style={{ marginTop: 16, textAlign: "left" }}>
        {track.album?.images?.[0]?.url ? (
          <img
            width="100%"
            src={track.album.images[0].url}
            alt="Track artwork"
          />
        ) : (
          <div>No Image</div>
        )}

        <p style={{ margin: "8px 0 0" }}>{track.name}</p>

        <p style={{ margin: "4px 0 0", opacity: 0.85 }}>
          {(track.artists ?? []).map((a) => a.name).join(", ")}
        </p>
      </div>
    ));
  }, [searchedTracks]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Spotify React</h1>

        {!token ? (
          <a href="#" onClick={loginHandler}>
            Login to Spotify
          </a>
        ) : (
          <button onClick={logout}>Logout</button>
        )}

        {authError ? (
          <p style={{ marginTop: 12 }}>
            <b>Erro de autenticação:</b> {authError}
          </p>
        ) : null}

        {token ? (
          <form onSubmit={searchTracks} style={{ marginTop: 16 }}>
            <input
              type="text"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              placeholder="Nome da música"
              className="search-input"
            />
            <button type="submit">Search</button>
          </form>
        ) : (
          <h2>Please login</h2>
        )}

        <div style={{ width: "100%", maxWidth: 520 }}>{tracksView}</div>
      </header>
    </div>
  );
}

export default App;