import { useEffect, useState } from 'react';
import './App.css';
import axios from 'axios';

function App() {
  const CLIENT_ID = "e763782ecad64301ac57eb44e3620060";
  const REDIRECT_URI = "http://localhost:3000";
  const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
  const RESPONSE_TYPE = "token";

  const [token, setToken] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [searchedTracks, setSearchedTracks] = useState([]);

  useEffect(() => {
    const hash = window.location.hash;
    let token = window.localStorage.getItem("token");

    if (!token && hash) {
      token = hash.substring(1).split("&").find(elem => elem.startsWith("access_token")).split("=")[1];

      window.location.hash = "";
      window.localStorage.setItem("token", token);
    }

    setToken(token);
  }, []);

  const logout = () => {
    setToken("");
    window.localStorage.removeItem("token");
  }

  const searchTracks = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          q: searchKey,
          type: "track"  // Alterado para buscar faixas (tracks)
        }
      });
      setSearchedTracks(data.tracks.items);
    } catch (error) {
      console.error('Erro ao buscar faixas:', error);
    }
  };

  const renderTracks = () => {
    return searchedTracks.map(track => (
      <div key={track.id}>
        {/* Exiba as informações da faixa, por exemplo: */}
        <div>{track.name}</div>
        <div>{track.artists.map(artist => artist.name).join(', ')}</div>
      </div>
    ));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Spotify React</h1>
        {!token ? (
          <a href={`${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}`}>Login to Spotify</a>
        ) : (
          <button onClick={logout}>Logout</button>
        )}

        {token ? (
          <form onSubmit={searchTracks}>
            <input
              type="text"
              onChange={e => setSearchKey(e.target.value)}
              placeholder="Nome da música"
              className="search-input"
            />
            <button type="submit">Search</button>
          </form>
          ) : (
          <h2>Please login</h2>
        )}

        {renderTracks()}
      </header>
    </div>
  );
}

export default App;
